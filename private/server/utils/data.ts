import '../types/global.d.ts';

import type { Context, ExecutionContext } from 'hono';
import type { FormattedResults, QueryHandlerOptions } from 'ronin/types';
import { runQueries as runQueriesOnRonin } from 'ronin/utils';

import type { Query, ResultRecord } from '@ronin/compiler';
import type { TriggersList } from '../types';
import { VERBOSE_LOGGING } from './constants';

/**
 * A minimal implementation of the `ExecutionContext` interface.
 *
 * We use this as a fallback default because on Node.js runtimes, primarily
 * in Vercel, no execution context is provided so we need to provide a mock
 * implementation.
 */
const EXECUTION_CONTEXT: ExecutionContext = {
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
 * Generate the options passed to the `ronin` JavaScript client.
 *
 * @param c - The context of the current request.
 * @param triggers - A list of triggers that should be executed.
 *
 * @returns Options that can be passed to the `ronin` JavaScript client.
 */
export const getRoninOptions = (
  c: Context,
  triggers?: TriggersList,
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

  // Trying to access `c.executionCtx` on a Node.js runtime, such as in a Vercel
  // function, it will throw an error. So we need to add a mockfallback.
  let dataFetcherWaitUntil: ExecutionContext['waitUntil'] = EXECUTION_CONTEXT.waitUntil;
  try {
    dataFetcherWaitUntil = c.executionCtx.waitUntil?.bind(c.executionCtx);
  } catch (_err) {
    if (VERBOSE_LOGGING)
      console.warn('No execution context provided, using default implementation.');
  }

  return {
    triggers,
    token: import.meta.env.BLADE_APP_TOKEN,
    fetch: dataFetcher,
    waitUntil: dataFetcherWaitUntil,
  };
};

/**
 * The same as `runQueries` exposed by the `ronin` JavaScript client, except that default
 * configuration options are provided.
 *
 * @param c - The context of the current request.
 * @param queries - A list of RONIN queries that should be executed.
 * @param triggers - A list of triggers that should be executed.
 *
 * @returns The results of the passed queries.
 */
export const runQueries = <T extends ResultRecord>(
  c: Context,
  queries: Record<string, Array<Query>>,
  triggers: TriggersList = {},
): Promise<Record<string, FormattedResults<T>>> => {
  return runQueriesOnRonin<T>(queries, getRoninOptions(c, triggers));
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
