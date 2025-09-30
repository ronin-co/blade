import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import { runQueries } from 'blade-client';
import type {
  BeforeGetTrigger,
  TriggerOptions as ClientTriggerOptions,
  FormattedResults,
  QueryHandlerOptions,
} from 'blade-client/types';
import type { Model, QueryType, ResultRecord } from 'blade-compiler';
import type { Context, ExecutionContext } from 'hono';
import { schema, triggers } from 'server-list';

import type { ServerContext } from '@/private/server/context';
import type { WaitUntil } from '@/private/server/types';
import type {
  TriggerOptions as NewTriggerOptions,
  Triggers,
} from '@/private/server/types';
import { VERBOSE_LOGGING } from '@/private/server/utils/constants';
import { WRITE_QUERY_TYPES } from '@/private/server/utils/constants';
import { getCookieSetter } from '@/private/universal/utils';

/**
 * A minimal mock implementation of the `ExecutionContext` interface.
 */
const MOCK_EXECUTION_CONTEXT: ExecutionContext = {
  passThroughOnException: () => {},
  waitUntil: async (func) => {
    try {
      await func;
    } catch (err) {
      if (!VERBOSE_LOGGING) return;
      console.error('An error occurred while executing a `waitUntil` callback.');
      console.error(err);
    }
  },
};

/**
 * Get the `waitUntil` function from the current context. If the context does not
 * provide a `waitUntil` function, we use a mock implementation.
 *
 * @param context - The context of the current request.
 *
 * @returns A function that takes a promise and waits for it to resolve.
 */
export const getWaitUntil = (context?: Context): WaitUntil => {
  if (import.meta.env.__BLADE_PROVIDER === 'vercel') return vercelWaitUntil;

  // Trying to access `c.executionCtx` on a Node.js runtime, such as in a Vercel
  // function, will throw an error. So we need to add a mockfallback.
  let dataFetcherWaitUntil = MOCK_EXECUTION_CONTEXT.waitUntil;
  if (!context) return dataFetcherWaitUntil;

  try {
    dataFetcherWaitUntil = context.executionCtx.waitUntil?.bind(context.executionCtx);
  } catch (_err) {
    if (VERBOSE_LOGGING)
      console.warn('No execution context provided, using default implementation.');
  }

  return dataFetcherWaitUntil;
};

/**
 * Turn the given string into "dash-case", which we use for slugs.
 *
 * @param string - String to turn into dash-case.
 *
 * @returns String compatible with "dash-case".
 *
 * Originally from https://github.com/rayepps/radash/blob/7c6b986d19c68f19ccf5863d518eb19ec9aa4ab8/src/string.ts#L60-L71.
 */
export const toDashCase = (string?: string | null): string => {
  const capitalize = (str: string) => {
    const lower = str.toLowerCase();
    return lower.substring(0, 1).toUpperCase() + lower.substring(1, lower.length);
  };

  const parts =
    string
      ?.replace(/([A-Z])+/g, capitalize)
      ?.split(/(?=[A-Z])|[.\-\s_]/)
      .map((x) => x.toLowerCase()) ?? [];

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  return parts.reduce((acc, part) => `${acc}-${part.toLowerCase()}`);
};

const models: Array<Model> = Object.values(schema['index.ts'] || {});

/**
 * Generate the options passed to the query client.
 *
 * @param serverContext - A server context object.
 * @param requireTriggers - Determines which triggers are required to be present.
 *
 * @returns Options that can be passed to the query client.
 */
export const getClientConfig = (
  serverContext: ServerContext,
  requireTriggers: 'all' | 'write' | 'none',
): QueryHandlerOptions => {
  const options: Partial<NewTriggerOptions> = {
    cookies: serverContext.cookies,
    setCookie: getCookieSetter(serverContext),
    navigator: {
      userAgent: serverContext.userAgent,
      geoLocation: serverContext.geoLocation,
      languages: serverContext.languages,
    },
    location: new URL(serverContext.url),
  };

  const list = Object.entries(triggers || {}).map(
    ([fileName, triggerList]): [string, Triggers] => {
      // For every trigger, update the existing options argument to provide additional
      // options that are specific to BLADE.
      const extendedTriggerEntries = Object.entries(triggerList).map(
        ([triggerName, triggerFunction]) => [
          triggerName,
          // This handles triggers of all types, but for the sake of being able to parse
          // the arguments of the original trigger type, we're using only the type of
          // `before*` triggers.
          (...args: Parameters<BeforeGetTrigger>) => {
            const argsBeforeLast = args.slice(0, -1);
            const oldOptions = args.at(-1) as ClientTriggerOptions;

            // Create an object of options that are specific to the current trigger
            // function, in order to avoid modifying the global object.
            const newOptions: Partial<NewTriggerOptions> = { ...options };

            if (requireTriggers === 'all') {
              // If all queries provided to the triggers stem from the same data source,
              // we can explicitly set the headless property to `true` or `false`.
              newOptions.headless = true;
            } else {
              const triggerNameSlug = triggerName.toLowerCase();

              // If the client informs us that the query was generated by a trigger, we
              // don't need to perform further checks, because it is guaranteed that the
              // query is not headless.
              //
              // Otherwise, if the client does not provide us with such information, we
              // need to check if the query is headless based on Blade's own primitives.
              if (oldOptions.parentTrigger) {
                newOptions.headless = false;
              } else {
                // If the queries stem from multiple different data sources, the type of
                // query that is being executed determines whether it stems from a
                // headless source, or not.
                //
                // Specifically, read queries are never headless because they always stem
                // from the server (where the database is located), whereas write queries
                // are always headless because they always stem from the client (where the
                // user expressing the intent is located). The only exception to this rule
                // is handled above, if `headless` is defined explicitly.
                newOptions.headless = WRITE_QUERY_TYPES.some((queryType) => {
                  return triggerNameSlug.endsWith(queryType);
                });
              }
            }

            const finalArgs = [...argsBeforeLast, { ...oldOptions, ...newOptions }];

            return triggerFunction(...finalArgs);
          },
        ],
      );

      return [fileName.replace('.ts', ''), Object.fromEntries(extendedTriggerEntries)];
    },
  );

  const finalTriggers = Object.fromEntries(list);
  const flush = serverContext.flushSession;

  let syntaxCallback: QueryHandlerOptions['syntaxCallback'];

  // If a function for flushing the current UI session was provided, that means we should
  // capture all query executions, check if they have `flush: true` set, and if so, invoke
  // the function for flushing the UI for them.
  if (flush) {
    syntaxCallback = async (queries, nestedOptions) => {
      const writing = queries.some((query) => {
        const queryType = Object.keys(query)[0] as QueryType;
        return (WRITE_QUERY_TYPES as Array<QueryType>).includes(queryType);
      });

      // If a write is being performed, and a `stream` option was provided, we need to
      // update the UI. Otherwise, we just need to execute the queries further below.
      if (writing && 'stream' in nestedOptions) {
        const { results } = await flush(queries, nestedOptions.stream);

        return results!
          .filter(({ type }) => type === 'write')
          .map(({ result }) => result) as FormattedResults<ResultRecord>;
      }

      return runQueries(queries, nestedOptions);
    };
  }

  return {
    triggers: finalTriggers,
    requireTriggers: requireTriggers === 'none' ? undefined : requireTriggers,
    waitUntil: serverContext.waitUntil,
    models,
    defaultRecordLimit: 20,
    debug: VERBOSE_LOGGING,
    syntaxCallback,
  };
};
