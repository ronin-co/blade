import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import type { FormattedResults, QueryHandlerOptions } from 'blade-client/types';
import { runQueries as runQueriesOnRonin } from 'blade-client/utils';
import type { Query, ResultRecord } from 'blade-compiler';
import type { Context, ExecutionContext } from 'hono';

import type { TriggersList, WaitUntil } from '@/private/server/types';
import { VERBOSE_LOGGING } from '@/private/server/utils/constants';

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
 * Generate the options passed to the `ronin` JavaScript client.
 *
 * @param triggers - A list of triggers that should be executed.
 * @param requireTriggers - Determines which triggers are required to be present.
 * @param waitUntil - A function for keeping the process alive until a promise has
 * been resolved.
 *
 * @returns Options that can be passed to the `ronin` JavaScript client.
 */
export const getRoninOptions = (
  triggers: TriggersList,
  requireTriggers: 'all' | 'write',
  waitUntil: WaitUntil,
): QueryHandlerOptions => {
  const dataFetcher: typeof fetch = async (input, init) => {
    // Normalize the parameters of the surrounding function, as the first argument might
    // either be a URL or a `Request` object.

    const request = new Request(input, init);

    const url = new URL(request.url);
    const type = url.host === 'data.ronin.co' ? 'data' : 'storage';
    const customHost =
      type === 'data'
        ? import.meta.env.BLADE_DATA_WORKER
        : import.meta.env.BLADE_STORAGE_WORKER;

    if (customHost) {
      const parsedCustomHost = new URL(customHost);

      url.protocol = parsedCustomHost.protocol;
      url.host = parsedCustomHost.host;
    }

    const start = performance.now();

    const res = await fetch(new Request(url, request));

    if (type === 'data' && VERBOSE_LOGGING) {
      console.log(`Received response from ${url} in ${performance.now() - start}ms`);
    }

    return res;
  };

  return {
    triggers,
    fetch: dataFetcher,
    requireTriggers,
    waitUntil,
  };
};

/**
 * The same as `runQueries` exposed by the `ronin` JavaScript client, except that default
 * configuration options are provided.
 *
 * @param queries - A list of RONIN queries that should be executed.
 * @param triggers - A list of triggers that should be executed.
 * @param requireTriggers - Determines which triggers are required to be present.
 * @param waitUntil - A function for keeping the process alive until a promise has
 * been resolved.
 *
 * @returns The results of the passed queries.
 */
export const runQueries = <T extends ResultRecord>(
  queries: Record<string, Array<Query>>,
  triggers: TriggersList,
  requireTriggers: 'all' | 'write',
  waitUntil: WaitUntil,
): Promise<Record<string, FormattedResults<T>>> => {
  const options = getRoninOptions(triggers, requireTriggers, waitUntil);
  return runQueriesOnRonin<T>(queries, options);
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
