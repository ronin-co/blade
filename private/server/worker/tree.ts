import '../../universal/types/global.d.ts';

import { type CookieSerializeOptions, serialize as serializeCookie } from 'cookie';
import { hooks as hookList, pages } from 'file-list';
import getValue from 'get-value';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { assign } from 'radash';
import React, { type ReactNode } from 'react';
// @ts-expect-error `@types/react-dom` is missing types for this file.
import { renderToReadableStream as renderToReadableStreamInitial } from 'react-dom/server.browser';
import type { FormattedResults, Query } from 'ronin/types';
import { InvalidResponseError } from 'ronin/utils';
import { serializeError } from 'serialize-error';

import { DataHookError } from '../../../public/server/utils/errors';
import type {
  PageFetchingOptions,
  QueryItemRead,
  QueryItemWrite,
} from '../../universal/types/util';
import Root from '../components/root.tsx';
import type { ServerContext } from '../context';
import type { PageMetadata, TreeItem } from '../types';
import { SECURITY_HEADERS, VERBOSE_LOGGING } from '../utils/constants';
import { runQueries } from '../utils/data';
import { assignFiles } from '../utils/files.ts';
import { getParentDirectories, joinPaths } from '../utils/paths';
import {
  getRequestGeoLocation,
  getRequestLanguages,
  getRequestUserAgent,
} from '../utils/request-context';
import { renderToReadableStream } from '../utils/serializer';
import { SERVER_CONTEXT } from './context';
import { prepareHooks } from './data-hooks';
import { type PageEntry, getEntryPath, getPathSegments } from './pages';

const getRenderingLeaves = (location: keyof typeof pages): Map<string, TreeItem> => {
  const leaves = new Map<string, TreeItem>();
  const parentDirectories = getParentDirectories(location);

  // Add current page to the rendering tree.
  leaves.set(location, pages[location]);

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
  const { requestContext } = serverContext;
  const hooks = prepareHooks(serverContext, hookList, {
    // TODO: Make this work for other spaces too.
    //
    // If queries that are specifically targeting the "ronin" database were provided,
    // that means the records of that space are currently being edited on the dashboard,
    // by the RONIN team.
    fromRoninDashboard: Boolean(queries['ronin']),
  });

  const databaseAmount = Object.keys(queries).length;
  const queryAmount = Object.values(queries).flat().length;

  const callback = () => runQueries(requestContext, queries, hooks);

  let results: Record<string, FormattedResults<unknown>> = {};

  try {
    // If hooks are used, we need to provide them with the server context.
    //
    // If none are used, however, we don't want to provide the server context, since
    // providing it causes the code inside to run synchronously.
    results = hooks
      ? await SERVER_CONTEXT.run(serverContext, callback)
      : await callback();
  } catch (err: unknown) {
    const spaceNotFound =
      databaseAmount > 1 && (err as { code?: string }).code === 'AUTH_INVALID_ACCESS';

    // If a custom "data selector" (custom database) was provided and an authentication
    // error is returned by RONIN, that means the addressed database was not found.
    //
    // In that case, we want to ignore the error and thereby fall back to an empty result
    // list, as this matches RONIN's general behavior whenever a query is executed for
    // which no records are found.
    //
    // Addressing a custom database is useful for cases in which a RONIN space contains
    // multiple databases and the developer wants to address a specific one.
    if (!spaceNotFound) throw err;
  }

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

const runQueriesPerType = async (
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
  // modified by developers inside the data hooks, which would break the deduplication of
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
    if (err instanceof DataHookError || err instanceof InvalidResponseError) {
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
    sortedList[index].result = flatResults[index];
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

const prepareRenderingTree = (
  leaves: Map<string, TreeItem>,
  serverContext: ServerContext,
): {
  updatedServerContext: ServerContext;
  canRun: { queries: boolean; jwts: boolean };
} => {
  return SERVER_CONTEXT.run(serverContext, () => {
    let hasNewQueries = false;
    let hasNewJwts = false;

    // Start with the uppermost layout.
    const reversedLeaves = Array.from(leaves.entries()).reverse();

    const updatedServerContext = SERVER_CONTEXT.getStore();
    if (!updatedServerContext) throw new Error('Missing server context store');

    let leavesCheckedForQueries = 0;

    for (let leafIndex = 0; leafIndex < reversedLeaves.length; leafIndex++) {
      const [, leaf] = reversedLeaves[leafIndex];

      updatedServerContext.currentLeafIndex = leafIndex;

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
          const { redirect: existingRedirect } = updatedServerContext.collected;
          const newRedirect = details.__blade_redirect;

          // If the redirect was not collected yet, add it to the collection.
          if (existingRedirect !== newRedirect) {
            updatedServerContext.collected.redirect = newRedirect;
          }

          // Don't continue checking other layouts or pages if a redirect was provided,
          // because that means the code execution should stop.
          break;
        }

        if ('__blade_queries' in details) {
          leavesCheckedForQueries++;
          const { queries: existingQueries } = updatedServerContext.collected;

          for (const queryDetails of details.__blade_queries) {
            const { query, database } = queryDetails;

            // If the query was already collected, don't add it again.
            if (
              existingQueries.some(
                (item) => item.query === query && item.database === database,
              )
            ) {
              continue;
            }

            // If the query was not collected yet, add it to the collection.
            hasNewQueries = true;
            existingQueries.push(queryDetails);
          }

          continue;
        }

        if ('__blade_jwt' in details) {
          const { jwts: existingJwts } = updatedServerContext.collected;
          const { token, secret, algo } = details.__blade_jwt;

          // If the JWT was not collected yet, add it to the collection.
          if (!existingJwts[token]) {
            existingJwts[token] = {
              decodedPayload: null,
              secret,
              algo,
            };

            hasNewJwts = true;
          }

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

    return {
      updatedServerContext,
      canRun: {
        queries: hasNewQueries && leavesCheckedForQueries === reversedLeaves.length,
        jwts: hasNewJwts,
      },
    };
  });
};

const getRenderingTree = (leaves: Map<string, TreeItem>) => {
  let element: ReactNode = null;
  let components: Record<string, React.ComponentType<unknown>> = {};

  for (const [path, leaf] of leaves.entries()) {
    if (!path.includes('layout.')) continue;
    components = { ...components, ...leaf.components };
  }

  for (const [, leaf] of leaves.entries()) {
    if (element) {
      element = React.createElement(leaf.default, { components }, element);
    } else {
      element = React.createElement(leaf.default, { components });
    }
  }

  if (!element) throw new Error('Rendering tree is empty');

  return React.createElement(Root, {}, element);
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
  return SERVER_CONTEXT.run(serverContext, async () => {
    const tree = getRenderingTree(renderingLeaves);

    const onError = (error: Error) => {
      throw error;
    };

    return (initial ? renderToReadableStreamInitial : renderToReadableStream)(tree, {
      onError,
    });
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

const renderReactTree = async (
  url: URL,
  /** The context of the current request. */
  c: Context,
  /** Whether the initial request is being handled (SSR). */
  initial: boolean,
  /** A list of options for customizing the rendering behavior. */
  options: Omit<PageFetchingOptions, 'queries'> = {},
  /** Existing properties that the server context should be primed with. */
  existingCollected?: Collected,
): Promise<Response | null> => {
  // In production, we always want to assume HTTPS as the protocol, since people should
  // never run BLADE (or apps in general) with HTTP. This is helpful for cases where the
  // app runs behind a load balancer that terminates TLS and passes on HTTP traffic to
  // the app. In that case, the URL received by BLADE via headers might have the `http`
  // protocol, but we want to treat it as `https` regardless. If someone really needs to
  // run BLADE with HTTP for some reason, we might offer a config flag in the future.
  if (import.meta.env.BLADE_ENV === 'production') url.protocol = 'https';

  const pathSegments = getPathSegments(url.pathname);
  const entry = getEntryPath(pages, pathSegments);

  const incomingCookies = structuredClone(getCookie(c));

  if (entry) {
    // When a 404 page is rendered, the address bar should still show the URL of the page
    // that was originally accessed.
    if (entry.notFound) options.updateAddressBar = false;
  } else {
    // Return early if the requested page doesn't exist.
    return null;
  }

  const rawRequest = c.req.raw;

  const serverContext: ServerContext = {
    // Available to both server and client components, because it can be serialized and
    // made available to the client-side.
    url: addPathSegmentsToURL(url, entry),
    params: entry.params,
    lastUpdate: Date.now(),
    userAgent: getRequestUserAgent(rawRequest),
    geoLocation: getRequestGeoLocation(rawRequest),
    languages: getRequestLanguages(rawRequest),
    addressBarInSync: options.updateAddressBar !== false,

    // Only available to server components. Cannot be serialized and made available on
    // the client-side (to client components).
    requestContext: c,
    cookies: incomingCookies,
    collected: existingCollected || {
      queries: [],
      metadata: {},
      jwts: {},
    },
    currentLeafIndex: null,
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

  // Simulate the behavior of React's promise handling by invoking all layouts and the
  // page of the current path. If one of them throws something we are interested in (such
  // as redirects or queries), we handle them accordingly and then invoke the layouts and
  // page again. At the end of the cycle, nothing will be thrown anymore. This is also
  // how React internally handles promises, except that we are implementing it ourselves.
  for (;;) {
    // Prime the server context with metadata, redirects, and similar.
    const { updatedServerContext, canRun } = prepareRenderingTree(
      renderingLeaves,
      serverContext,
    );

    // Assign redirects, metadata, and cookies.
    serverContext.collected = assign(
      serverContext.collected,
      updatedServerContext.collected,
    );

    // Below, we lift certain asynchronous operations out of the async context, which
    // allows us to run them asynchronously without blocking the thread, and, in certain
    // cases such as the queries, even combine multiple operations into a single
    // operation and/or re-use their results between multiple layouts and pages, which
    // speeds up the rendering.

    const queriesWithoutResults = serverContext.collected.queries.filter(
      ({ result, error }) => {
        return typeof result === 'undefined' && typeof error === 'undefined';
      },
    );

    const jwtsWithoutPayloads = Object.entries(serverContext.collected.jwts).filter(
      ([, value]) => {
        return !value.decodedPayload;
      },
    );

    const hasQueriesToRun = canRun.queries && queriesWithoutResults.length > 0;
    const hasJwtsToRun = canRun.jwts && jwtsWithoutPayloads.length > 0;

    if (hasQueriesToRun) {
      const hasWriteQueries = queriesWithoutResults.some(({ type }) => type === 'write');
      const hasErrorQueries = queriesWithoutResults.some(
        ({ error }) => typeof error !== 'undefined',
      );

      try {
        await runQueriesPerType(
          serverContext,
          queriesWithoutResults,
          options.files,
          url.pathname,
        );
      } catch (err) {
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

            return renderReactTree(new URL(newPathname, url), c, initial, options, {
              queries: serverContext.collected.queries.filter(
                ({ type }) => type === 'write',
              ),
              metadata: {},
              jwts: {},
            });
          }
        } else {
          throw err;
        }
      }
    }

    if (hasJwtsToRun) {
      await Promise.all(
        jwtsWithoutPayloads.map(async ([token, { secret, algo }]) => {
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

    // If queries or JWTs were executed, we need to re-run the layouts and pages with the
    // respective results. Alternatively, if none were executed, we don't need to re-run
    // the layouts and pages either.
    if (hasQueriesToRun || hasJwtsToRun) continue;
    break;
  }

  const writeQueryResults = serverContext.collected.queries
    .filter(({ type }) => type === 'write')
    .map(({ result }) => result);

  const curlyBracesToReplace = /%7B(.*)%7D/g;

  // If the `pathname` of the page that should be rendered contains field segments
  // (represented as `{0.handle}`, for example), we want to replace those with the fields
  // contained in the results of the queries that were performed. For example, this
  // allows for asking BLADE to provide the destination page of a redirect directly
  // instead of first rendering the original page again and then redirecting.
  if (writeQueryResults.length > 0 && url.pathname.match(curlyBracesToReplace)) {
    // We need to use the URL-encoded version of the `{` and `}` characters, as URL
    // instances in JavaScript automatically encode the URL.
    const newPathname = url.pathname.replace(curlyBracesToReplace, (_, content) =>
      getValue(writeQueryResults, content),
    );

    return renderReactTree(new URL(newPathname, url), c, initial, options, {
      queries: serverContext.collected.queries,
      metadata: {},
      jwts: {},
    });
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
      c,
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
    // Enable JavaScript performance profiling for Sentry.
    headers.set('Document-Policy', 'js-profiling');
  } else {
    headers.set('Content-Type', 'application/json');
    headers.set('X-Bundle-Id', import.meta.env['__BLADE_ASSETS_ID']);
    headers.set('X-Update-Time', serverContext.lastUpdate.toString());
  }

  return new Response(body, { headers });
};

export default renderReactTree;
