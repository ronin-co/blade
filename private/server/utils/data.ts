import '../types/global.d.ts';

import type { Context } from 'hono';
import type { FormattedResults, QueryHandlerOptions } from 'ronin/types';
import { runQueries as runQueriesOnRonin } from 'ronin/utils';

import type { Query, ResultRecord } from '@ronin/compiler';
import type { EffectsList } from '../types';
import { VERBOSE_LOGGING } from './constants';

/**
 * Generate the options passed to the `ronin` JavaScript client.
 *
 * @param c - The context of the current request.
 * @param effects - A list of effects that should be executed.
 *
 * @returns Options that can be passed to the `ronin` JavaScript client.
 */
export const getRoninOptions = (
  c: Context,
  effects?: EffectsList,
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

  console.log('c.executionCtx', c.executionCtx);
  const dataFetcherWaitUntil = c.executionCtx.waitUntil?.bind(c.executionCtx);

  return {
    effects,
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
 * @param effects - A list of effects that should be executed.
 *
 * @returns The results of the passed queries.
 */
export const runQueries = <T extends ResultRecord>(
  c: Context,
  queries: Record<string, Array<Query>>,
  effects: EffectsList = {},
): Promise<Record<string, FormattedResults<T>>> => {
  return runQueriesOnRonin<T>(queries, getRoninOptions(c, effects));
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
