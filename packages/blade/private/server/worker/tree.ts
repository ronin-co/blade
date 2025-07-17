import type { Toc } from '@stefanprobst/rehype-extract-toc';
import { bundleId as serverBundleId } from 'build-meta';
import {
  type CookieSerializeOptions,
  parse as parseCookies,
  serialize as serializeCookie,
} from 'cookie';
import getValue from 'get-value';
import { verify } from 'hono/jwt';
import type { SSEStreamingApi } from 'hono/streaming';
import { sleep } from 'radash';
import React, { type ReactNode } from 'react';
// @ts-expect-error `@types/react-dom` is missing types for this file.
import { renderToReadableStream as renderToReadableStreamInitial } from 'react-dom/server.browser';
import type { FormattedResults, Query } from 'ronin/types';
import { ClientError } from 'ronin/utils';
import { serializeError } from 'serialize-error';
import { pages as pageList, triggers as triggerList } from 'server-list';

import Root from '@/private/server/components/root';
import { RootServerContext, type ServerContext } from '@/private/server/context';
import * as DefaultPage404 from '@/private/server/pages/404';
import * as DefaultPage500 from '@/private/server/pages/500';
import type { PageList, PageMetadata, TreeItem } from '@/private/server/types';
import { SECURITY_HEADERS, VERBOSE_LOGGING } from '@/private/server/utils/constants';
import { IS_SERVER_DEV } from '@/private/server/utils/constants';
import { getWaitUntil, runQueries } from '@/private/server/utils/data';
import { assignFiles } from '@/private/server/utils/files';
import { getParentDirectories, joinPaths } from '@/private/server/utils/paths';
import {
  getRequestGeoLocation,
  getRequestLanguages,
  getRequestUserAgent,
} from '@/private/server/utils/request-context';
import {
  mountReactDispatcher,
  renderToReadableStream,
} from '@/private/server/utils/serializer';
import { type PageEntry, getEntry, getPathSegments } from '@/private/server/worker/pages';
import { prepareTriggers } from '@/private/server/worker/triggers';
import type {
  PageFetchingOptions,
  QueryItemRead,
  QueryItemWrite,
} from '@/private/universal/types/util';
import { DEFAULT_PAGE_PATH } from '@/private/universal/utils/constants';
import { TriggerError } from '@/public/server/utils/errors';

const pages: PageList = {
  ...pageList,
  [joinPaths(DEFAULT_PAGE_PATH, '404.tsx')]: DefaultPage404,
  [joinPaths(DEFAULT_PAGE_PATH, '500.tsx')]: DefaultPage500,
};

const getRenderingLeaves = (location: keyof PageList): Map<string, TreeItem> => {
  const leaves = new Map<string, TreeItem>();
  const parentDirectories = getParentDirectories(location);

  // Add current page to the rendering tree.
  leaves.set(location, pages[location] as TreeItem);

  // Add parent layouts surrounding the current page to the rendering tree.
  for (const dir of parentDirectories) {
    const layoutPath = joinPaths(dir, 'layout.tsx');

    if (typeof pages[layoutPath] === 'object') {
      leaves.set(layoutPath, pages[layoutPath]);
    }
  }

  return leaves;
};

const runQueriesWithTime = async (
  serverContext: ServerContext,
  path: string,
  queries: Record<string, Array<Query>>,
): Promise<Record<string, FormattedResults<unknown>>> => {
  if (VERBOSE_LOGGING) console.log('-'.repeat(20));

  const start = Date.now();
  const triggers = prepareTriggers(serverContext, triggerList);

  const databaseAmount = Object.keys(queries).length;
  const queryAmount = Object.values(queries).flat().length;

  const results: Record<string, FormattedResults<unknown>> = await runQueries(
    queries,
    triggers,
    'write',
    serverContext.waitUntil,
  );

  const end = Date.now();

  const databases = databaseAmount > 1 ? ` targeting ${databaseAmount} databases` : '';
  console.log(
    `[BLADE] Page ${path} took ${end - start}ms for ${queryAmount} queries${databases}`,
  );

  if (VERBOSE_LOGGING) {
    console.log('-'.repeat(20));
    console.log(`"queries": ${JSON.stringify(queries)}`);
    console.log('-'.repeat(20));
  }

  return results;
};

const obtainQueryResults = async (
  serverContext: ServerContext,
  originalList: (QueryItemRead | QueryItemWrite)[],
  files: Map<string, Blob> | undefined,
  path: string,
) => {
  if (originalList.length === 0) return;

  // Sort the queries in alphabetical order by database, but position queries that don't
  // have a database at the beginning of the list.
  //
  // We are intentionally creating a new array here, to avoid affecting the order of the
  // original queries, since other parts of the code might rely on the original order.
  //
  // It is extremely important that the queries per database retain the same order, since
  // the application that is using blade of course expects queries to be run in the order
  // in which they were provided.
  const sortedList = originalList.toSorted((a, b) => {
    if (!a.database && !b.database) return 0;
    if (!a.database) return -1;
    if (!b.database) return 1;

    return a.database.localeCompare(b.database);
  });

  // Convert the queries from strings to objects, so that we can execute them and attach
  // any potential files that might be available.
  //
  // If we would store raw objects instead of strings, the original objects would be
  // modified by developers inside the triggers, which would break the deduplication of
  // queries in the framework. We also wouldn't be able to clone the queries, since they
  // might contain binary objects, which cannot be cloned. Storing the queries as strings
  // and converting them into objects a single time (here) is therefore more efficient.
  const reducedQueries = sortedList.reduce(
    (acc, { query, database = 'default' }) => {
      const parsedQuery = JSON.parse(query);
      const finalQuery = files ? assignFiles(parsedQuery, files) : parsedQuery;

      if (!acc[database]) acc[database] = [];
      acc[database].push(finalQuery);
      return acc;
    },
    {} as Record<string, Array<Query>>,
  );

  let results: Record<string, FormattedResults<unknown>> = {};

  try {
    results = await runQueriesWithTime(serverContext, path, reducedQueries);
  } catch (err) {
    if (
      err instanceof TriggerError ||
      // Raise up errors about databases not existing, because they will be caught at a
      // higher level and handled accordingly. Also do the same for cases in which
      // triggers are required and missing (essential security measure).
      (err instanceof ClientError &&
        !['AUTH_INVALID_ACCESS', 'TRIGGER_REQUIRED'].includes(err.code))
    ) {
      const serializedError = serializeError(err);

      // Expose the error for all affected queries.
      for (const queryDetails of sortedList) {
        const queryEntryIndex = serverContext.collected.queries.findIndex((item) => {
          return (
            item.query === queryDetails.query && item.database === queryDetails.database
          );
        });

        if (queryEntryIndex === -1) throw new Error('Missing query entry index');
        serverContext.collected.queries[queryEntryIndex].error = serializedError;
      }

      (err as { renderable?: boolean }).renderable = true;
    }

    throw err;
  }

  const flatResults = Object.entries(results).flatMap(([_database, results]) => results);

  // Assign the results to their respective queries.
  for (let index = 0; index < flatResults.length; index++) {
    const queryDetails = sortedList[index];

    const queryEntryIndex = serverContext.collected.queries.findIndex((item) => {
      return item.query === queryDetails.query && item.database === queryDetails.database;
    });

    if (queryEntryIndex === -1) throw new Error('Missing query entry index');
    serverContext.collected.queries[queryEntryIndex].result = flatResults[index];
  }
};

export interface Collected {
  queries: (QueryItemRead | QueryItemWrite)[];
  redirect?: string;
  metadata: PageMetadata;
  cookies?: Record<string, { value: string | null } & CookieSerializeOptions>;
  jwts: Record<
    string,
    {
      decodedPayload: unknown;
      secret: Parameters<typeof verify>[1];
      algo: Parameters<typeof verify>[2];
    }
  >;
}

interface CollectedRunnable extends Pick<Collected, 'queries' | 'jwts'> {}

const collectPromises = (
  leaves: Map<string, TreeItem>,
  serverContext: ServerContext,
  existingNewlyAdded?: CollectedRunnable,
): CollectedRunnable => {
  mountReactDispatcher();

  // Expose the server context to the React tree, so that it can be read from hooks.
  //
  // @ts-expect-error This is an internal React property.
  RootServerContext._currentValue = serverContext;

  const freshlyAdded: CollectedRunnable = { queries: [], jwts: {} };

  // Start with the uppermost layout.
  const reversedLeaves = Array.from(leaves.entries()).reverse();

  let leavesCheckedForQueries = 0;

  for (let leafIndex = 0; leafIndex < reversedLeaves.length; leafIndex++) {
    const [, leaf] = reversedLeaves[leafIndex];

    serverContext.currentLeafIndex = leafIndex;

    try {
      leaf.default({});
    } catch (item) {
      const details = item as
        | Error
        | { __blade_redirect: string }
        | { __blade_queries: QueryItemRead[] }
        | {
            __blade_jwt: {
              token: Parameters<typeof verify>[0];
              secret: Parameters<typeof verify>[1];
              algo: Parameters<typeof verify>[2];
            };
          };

      if ('__blade_redirect' in details) {
        const { redirect: existingRedirect } = serverContext.collected;
        const newRedirect = details.__blade_redirect;

        // If the redirect was not collected yet, add it to the collection.
        if (existingRedirect !== newRedirect) {
          serverContext.collected.redirect = newRedirect;
        }

        // Don't continue checking other layouts or pages if a redirect was provided,
        // because that means the code execution should stop.
        break;
      }

      if ('__blade_queries' in details) {
        leavesCheckedForQueries++;

        for (const queryDetails of details.__blade_queries) {
          const { query, database } = queryDetails;

          // If the query was already collected, don't add it again.
          if (
            serverContext.collected.queries.some((item) => {
              return item.query === query && item.database === database;
            })
          ) {
            continue;
          }

          // If the query was not collected yet, add it to the collection.
          freshlyAdded.queries.push(queryDetails);
        }

        continue;
      }

      if ('__blade_jwt' in details) {
        const { token, secret, algo } = details.__blade_jwt;

        // If the query was already collected, don't add it again.
        if (serverContext.collected.jwts[token]) continue;

        // If the JWT was not collected yet, add it to the collection.
        freshlyAdded.jwts[token] = {
          decodedPayload: null,
          secret,
          algo,
        };

        continue;
      }

      // Ignore errors thrown by `use()`.
      if (item instanceof Error && item.message.includes(".use'")) {
        leavesCheckedForQueries++;
        continue;
      }

      throw details;
    }

    leavesCheckedForQueries++;
  }

  // Whether all tree leaves have been checked for queries.
  const checkedAllLeaves = leavesCheckedForQueries === reversedLeaves.length;

  const queries = checkedAllLeaves ? freshlyAdded.queries : [];
  const jwts = freshlyAdded.jwts;

  // Assign newly added queries to context.
  for (const newQuery of queries) {
    serverContext.collected.queries.push(newQuery);
  }

  // Assign newly added JWTs to context.
  for (const [token, details] of Object.entries(jwts)) {
    serverContext.collected.jwts[token] = details;
  }

  return {
    queries: [...(existingNewlyAdded?.queries || []), ...queries],
    jwts: { ...existingNewlyAdded?.jwts, ...jwts },
  };
};

const getRenderingTree = (
  leaves: Map<string, TreeItem>,
  serverContext: ServerContext,
) => {
  let element: ReactNode = null;
  let components: Record<string, React.ComponentType<unknown>> = {};
  let toc: Toc = [];

  for (const [path, leaf] of leaves.entries()) {
    if (leaf.tableOfContents && leaf.tableOfContents.length > 0) {
      toc = leaf.tableOfContents;
    }
    if (!path.includes('layout.')) continue;
    components = { ...components, ...leaf.components };
  }

  for (const [, leaf] of leaves.entries()) {
    if (element) {
      element = React.createElement(
        leaf.default,
        { components, tableOfContents: toc },
        element,
      );
    } else {
      element = React.createElement(leaf.default, { components, tableOfContents: toc });
    }
  }

  if (!element) throw new Error('Rendering tree is empty');

  return React.createElement(Root, { serverContext }, element);
};

const addPathSegmentsToURL = (requestURL: URL, entry: PageEntry): string => {
  const extension = entry.path.includes('.mdx') ? 'mdx' : 'tsx';
  let relativePath = entry.path
    .replace(`index.${extension}`, '')
    .replace(`.${extension}`, '');

  if (relativePath.endsWith('/')) {
    relativePath = relativePath.substring(0, relativePath.length - 1);
  }

  // Clone the URL before modifying it, otherwise we'll modify the URL outside the
  // function, which will affect other functions in the upper level.
  const url = new URL(requestURL);
  url.pathname = relativePath;

  return url.href;
};

const renderShell = async (
  initial: boolean,
  renderingLeaves: ReturnType<typeof getRenderingLeaves>,
  serverContext: ServerContext,
): Promise<ReadableStream> => {
  const tree = getRenderingTree(renderingLeaves, serverContext);

  const onError = (error: Error) => {
    throw error;
  };

  return (initial ? renderToReadableStreamInitial : renderToReadableStream)(tree, {
    onError,
  });
};

/**
 * Composes a `Set-Cookie` header and appends it to a list of existing headers.
 *
 * @param headers - The existing headers to append the `Set-Cookie` header to.
 * @param cookies - The list of cookies to set.
 *
 * @returns The new list of headers, including `Set-Cookie`.
 */
const appendCookieHeader = (
  headers: Headers,
  cookies: Collected['cookies'] = {},
): Headers => {
  for (const key in cookies) {
    const settings = cookies[key];
    const { value, ...config } = settings;
    headers.append(
      'Set-Cookie',
      serializeCookie(key, value === null ? '' : value, config),
    );
  }

  return headers;
};

/**
 * Renders a new React tree for a particular browser session and flushes it down to the
 * client, which then updates the UI on the client.
 *
 * @param id - The ID of the session for which an update should be flushed.
 * @param [options.queries] - A list of write queries that should be executed.
 * @param [options.repeat] - Whether to flush another update for the session later on.
 *
 * @returns If `repeat` is not set, a promise that resolves once the session has been
 * flushed once. Otherwise, if `repeat` is set, a promise that remains pending as long as
 * the session continues to exist.
 */
export const flushSession = async (
  stream: SSEStreamingApi,
  url: URL,
  headers: Headers,
  correctBundle: boolean,
  options?: {
    queries?: Collected['queries'];
    repeat?: boolean;
  },
): Promise<void> => {
  // If the client is no longer connected, don't try to push an update. This therefore
  // also stops the interval of continuous revalidation.
  if (stream.aborted || stream.closed) return;

  const nestedFlushSession: ServerContext['flushSession'] = async (nestedQueries) => {
    const newOptions: Parameters<typeof flushSession>[4] = {
      queries: nestedQueries
        ? nestedQueries.map((query) => ({
            hookHash: crypto.randomUUID(),
            query: JSON.stringify(query),
            type: 'write',
          }))
        : undefined,
    };

    return flushSession(stream, url, headers, true, newOptions);
  };

  try {
    // If the session does exist, render an update for it.
    const page = await renderReactTree(
      url,
      headers,
      !correctBundle,
      {
        waitUntil: getWaitUntil(),
        flushSession: options?.repeat ? nestedFlushSession : undefined,
      },
      options?.queries
        ? {
            jwts: {},
            metadata: {},
            queries: options.queries,
          }
        : undefined,
    );

    // Afterward, flush the update over the stream.
    await stream.writeSSE({
      id: `${crypto.randomUUID()}-${serverBundleId}`,
      event: correctBundle ? 'update' : 'update-bundle',
      data: page.text(),
    });
  } catch (err) {
    // If another update is being attempted later on anyways, we don't need to throw the
    // error, since that would also prevent the repeated update later on.
    if (options?.repeat) {
      console.error('Failed to flush session update, retrying later:', err);
    } else {
      throw err;
    }
  }

  // If the update should be repeated later, wait for 5 seconds and then attempt
  // flushing yet another update.
  if (options?.repeat) {
    await sleep(5000);
    return flushSession(stream, url, headers, true, options);
  }
};

const renderReactTree = async (
  /** The URL of the current request. */
  requestURL: URL,
  /** The headers of the current request. */
  requestHeaders: Headers,
  /** Whether the initial request is being handled (SSR). */
  initial: boolean,
  /** A list of options for customizing the rendering behavior. */
  options: Omit<PageFetchingOptions, 'queries'> & {
    /** Whether an error page should be rendered, and for which error code. */
    error?: 404 | 500;
    /** The reason why the error page is being rendered. */
    errorReason?: 'database-not-found' | 'model-not-found';
    /**
     * Whether to force a native error page to be rendered because the app-provided error
     * page is not renderable.
     */
    forceNativeError?: boolean;
    /** A function for keeping the process alive until a promise has been resolved. */
    waitUntil: ServerContext['waitUntil'];
    /** A function for flushing an update for the current browser session. */
    flushSession?: ServerContext['flushSession'];
  },
  /** Existing properties that the server context should be primed with. */
  existingCollected?: Collected,
): Promise<Response> => {
  const url = new URL(requestURL);

  // See https://github.com/ronin-co/blade/pull/31 for more details.
  if (!IS_SERVER_DEV) url.protocol = 'https';

  const pathSegments = getPathSegments(url.pathname);
  const entry = getEntry(pages, pathSegments, {
    error: options.error,
    forceNativeError: options.forceNativeError,
  });

  const incomingCookies = structuredClone(
    parseCookies(requestHeaders.get('cookie') || ''),
  );

  if (entry.errorPage) {
    // When an error page is rendered, the address bar should still show the URL of the
    // page that was originally accessed.
    options.updateAddressBar = false;

    // If an error reason was provided, expose it using query params to the error page.
    if (options.errorReason) url.searchParams.set('reason', options.errorReason);
  }

  const serverContext: ServerContext = {
    // Available to both server and client components, because it can be serialized and
    // made available to the client-side.
    url: addPathSegmentsToURL(url, entry),
    params: entry.params,
    userAgent: getRequestUserAgent(requestHeaders),
    geoLocation: getRequestGeoLocation(requestHeaders),
    languages: getRequestLanguages(requestHeaders),
    addressBarInSync: options.updateAddressBar !== false,

    // Only available to server components. Cannot be serialized and made available on
    // the client-side (to client components).
    cookies: incomingCookies,
    collected: existingCollected || {
      queries: [],
      metadata: {},
      jwts: {},
    },
    currentLeafIndex: null,
    waitUntil: options.waitUntil,
    flushSession: options.flushSession,
  };

  const collectedCookies = serverContext.collected.cookies || {};

  for (const key in collectedCookies) {
    const settings = collectedCookies[key];

    if (settings.value === null) {
      delete incomingCookies[key];
    } else {
      incomingCookies[key] = settings.value;
    }
  }

  const renderingLeaves = getRenderingLeaves(entry.path);

  const existingNewlyAdded: CollectedRunnable = {
    queries: serverContext.collected.queries.filter(({ result, error }) => {
      return typeof result === 'undefined' && typeof error === 'undefined';
    }),
    jwts: Object.fromEntries(
      Object.entries(serverContext.collected.jwts).filter(([, value]) => {
        return !value.decodedPayload;
      }),
    ),
  };

  // If the `href` (covers both `pathname` and `search` at once) of the page that should
  // be rendered contains field segments (represented as `{0.handle}`, for example), we
  // want to replace those with the field values contained in the results of the queries
  // that were run. For example, this allows for instructing BLADE to immediately provide
  // the destination page of a redirect directly instead of first rendering the original
  // page again and then redirecting.
  const curlyBracesToReplace = /\{([^{}]+)\}/g;

  let decodedHref: string = url.href;
  let hasPatternInURL: RegExpMatchArray | null = null;

  try {
    // We must decode the URL before checking for patterns, since the patterns might be
    // encoded, in which case the regex above wouldn't match them.
    decodedHref = decodeURIComponent(url.href);
    hasPatternInURL = decodedHref.match(curlyBracesToReplace);
  } catch (_err) {
    // If decoding the URL fails, the client might have provided an invalid URL, in which
    // case we should not throw an error, but instead continue with the URL as it is,
    // because Blade is not responsible for deciding whether a URL is valid or not.
    //
    // Since, in that case, we are sure that the URL does not contain patterns that we
    // are interested in, we let the application decide how to proceed (e.g. by just
    // rendering a "Not Found" page for the path).
  }

  let index = 0;

  // Simulate the behavior of React's promise handling by invoking all layouts and the
  // page of the current path. If one of them throws something we are interested in (such
  // as redirects or queries), we handle them accordingly and then invoke the layouts and
  // page again. At the end of the cycle, nothing will be thrown anymore. This is also
  // how React internally handles promises, except that we are implementing it ourselves.
  while (true) {
    let newlyAdded = existingNewlyAdded;

    // If the URL contains patterns such as `{0.handle}`, we don't want to collect any
    // read queries from the target page. Instead, we only want to continue with the
    // write queries that were already provided, since those must be executed before we
    // can fill the pattern with an actual value and render the page.
    if (!hasPatternInURL) {
      // Prime the server context with metadata, redirects, and similar.
      newlyAdded = collectPromises(
        renderingLeaves,
        serverContext,
        // On the first run, provide existing queries and JWTs that were already provided.
        index === 0 ? existingNewlyAdded : undefined,
      );
    }

    // Below, we lift certain asynchronous operations out of the async context, which
    // allows us to run them asynchronously without blocking the thread, and, in certain
    // cases such as the queries, even combine multiple operations into a single
    // operation and/or re-use their results between multiple layouts and pages, which
    // speeds up the rendering.

    if (newlyAdded.queries.length > 0) {
      const hasWriteQueries = newlyAdded.queries.some(({ type }) => type === 'write');
      const hasErrorQueries = newlyAdded.queries.some(
        ({ error }) => typeof error !== 'undefined',
      );

      try {
        await obtainQueryResults(
          serverContext,
          newlyAdded.queries,
          options.files,
          // If the URL contains patterns such as `{0.handle}`, an error fallback page
          // is always present, because write queries can only be executed with an error
          // fallback page that can be rendered in the case that the queries fail.
          hasPatternInURL ? (options.errorFallback as string) : url.pathname,
        );
      } catch (err) {
        // If one of the accessed databases or models does not exist, display a 404 page.
        // This is necessary because both of them might be accessed directly through URL
        // paths, such as `/[space]/explore/[model]` on the RONIN dashboard.
        if (
          err instanceof ClientError &&
          (err.code === 'AUTH_INVALID_ACCESS' || err.code === 'MODEL_NOT_FOUND')
        ) {
          // If the current page is already a 404 (defined in the app), log the error and
          // render the native 404 page instead, because, in that case, the app-provided
          // 404 page relies on queries that are causing this error.
          let forceNativeError: boolean | undefined;

          if (entry.errorPage === 404) {
            console.error(err);
            forceNativeError = true;
          }

          const type = err.code === 'AUTH_INVALID_ACCESS' ? 'database' : 'model';
          // TODO: Determine the exact database or model that was not found, by extending
          // the error returned from the backend.
          console.log(`[BLADE] The provided ${type} was not found`);

          return renderReactTree(url, requestHeaders, initial, {
            error: 404,
            errorReason: `${type}-not-found`,
            forceNativeError,
            waitUntil: options.waitUntil,
          });
        }

        if ((err as { renderable?: boolean }).renderable) {
          // If an error was thrown during the execution of the provided write queries,
          // we can render the page fresh and pass the error to it, so that the page can
          // display the error.
          //
          // However, this should only happen if the current render isn't already being
          // used to display an error (`hasErrorQueries`), as, in that case, we need to
          // prevent an infinite loop.
          //
          // Furthermore, if no write queries were provided, it is guaranteed that the
          // error was caused by a read query, in which case we don't want to try
          // rendering the page again and pass the error. Instead, we want to abort the
          // render immediately and throw the error, because it is guaranteed that
          // subsequent renders will also fail.
          //
          // The reason why we're rendering the page again in the case that write queries
          // were provided is that there's a chance that it is the write queries that
          // caused the error, and not the read queries.
          if (!hasErrorQueries && hasWriteQueries) {
            // Optionally fall back to a different page if the queries have failed.
            const newPathname = options.errorFallback || url.pathname;

            return renderReactTree(
              new URL(newPathname, url),
              requestHeaders,
              initial,
              options,
              {
                queries: serverContext.collected.queries.filter(
                  ({ type }) => type === 'write',
                ),
                metadata: {},
                jwts: {},
              },
            );
          }
        } else {
          throw err;
        }
      }
    }

    const normalizedJwts = Object.entries(newlyAdded.jwts);

    if (normalizedJwts.length > 0) {
      await Promise.all(
        normalizedJwts.map(async ([token, { secret, algo }]) => {
          let result = null;

          try {
            result = await verify(token, secret, algo);
          } catch (err) {
            result = err;
          }

          serverContext.collected.jwts[token].decodedPayload = result;
        }),
      );
    }

    index++;

    if (
      (newlyAdded.queries.length > 0 || normalizedJwts.length > 0) &&
      !hasPatternInURL
    ) {
      continue;
    }

    break;
  }

  const writeQueryResults = serverContext.collected.queries
    .filter(({ type }) => type === 'write')
    .map(({ result }) => result);

  if (hasPatternInURL && writeQueryResults.length > 0) {
    const newURL = decodedHref.replace(curlyBracesToReplace, (_, content) =>
      getValue(writeQueryResults, content),
    );

    return renderReactTree(
      new URL(newURL, requestURL),
      requestHeaders,
      initial,
      options,
      {
        // We only need to pass the queries to the page, in order to provide the page with
        // the results of the write queries that were executed.
        queries: serverContext.collected.queries,
        // The other properties should be empty, since nothing else was collected yet.
        jwts: {},
        metadata: {},
      },
    );
  }

  const headers = appendCookieHeader(
    new Headers(SECURITY_HEADERS),
    serverContext.collected.cookies || {},
  );

  if (serverContext.collected.redirect) {
    if (initial) {
      headers.set('Location', serverContext.collected.redirect);

      return new Response(null, {
        headers,
        status: 307,
      });
    }

    return renderReactTree(
      new URL(serverContext.collected.redirect, url),
      requestHeaders,
      initial,
      options,
      {
        ...serverContext.collected,
        redirect: undefined,
        cookies: structuredClone(serverContext.collected.cookies),
        // Do not carry the result of write queries over to the next page. The result of
        // read queries can be carried over, however, which might speed up the rendering
        // of the next page.
        queries: serverContext.collected.queries.filter(({ type }) => type === 'read'),
      },
    );
  }

  const body = await renderShell(initial, renderingLeaves, serverContext);

  if (initial) {
    headers.set('Content-Type', 'text/html; charset=utf-8');
    // Enable JavaScript performance profiling for libraries like Sentry.
    headers.set('Document-Policy', 'js-profiling');
  } else {
    headers.set('Content-Type', 'application/json');
    // The ID of the main bundle currently available on the server.
    headers.set('X-Server-Bundle-Id', serverBundleId);
  }

  return new Response(body, { headers });
};

export default renderReactTree;
