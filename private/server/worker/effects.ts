import type { BeforeGetEffect } from 'ronin/types';

import type { ServerContext } from '../context';
import type { EffectOptions, Effects, EffectsList } from '../types';
import { WRITE_QUERY_TYPES } from '../utils/constants';

/**
 * Convert a list of effect files to effects that can be passed to RONIN.
 *
 * @param serverContext - A partial server context object.
 * @param effects - The effects that should be prepared for invocation.
 * @param headless - Whether the effects are being run for a headless source, meaning the
 * application's browser client or REST API. If queries from multiple different sources
 * are provided, this argument should be omitted.
 *
 * @returns Effects ready to be passed to RONIN.
 */
export const prepareEffects = (
  serverContext: Partial<ServerContext> &
    Pick<ServerContext, 'cookies' | 'userAgent' | 'geoLocation' | 'languages' | 'url'>,
  effects: EffectsList,
  headless?: boolean,
): EffectsList => {
  const options: Partial<EffectOptions> = {
    cookies: serverContext.cookies,
    navigator: {
      userAgent: serverContext.userAgent,
      geoLocation: serverContext.geoLocation,
      languages: serverContext.languages,
    },
    location: new URL(serverContext.url),
  };

  const list = Object.entries(effects || {}).map(
    ([fileName, effectList]): [string, Effects] => {
      // For every effect, update the existing options argument to provide additional
      // options that are specific to BLADE.
      const extendedEffectEntries = Object.entries(effectList).map(
        ([effectName, effectFunction]) => [
          effectName,
          // This handles effects of all types, but for the sake of being able to parse
          // the arguments of the original effect type, we're using only the type of
          // `before*` effects.
          (...args: Parameters<BeforeGetEffect>) => {
            const argsBeforeLast = args.slice(0, -1);
            const lastArg = args.at(-1) as object;

            // Create an object of options that are specific to the current effect
            // function, in order to avoid modifying the global object.
            const newOptions = { ...options };

            if (typeof headless === 'boolean') {
              // If all queries provided to the effects stem from the same data source,
              // we can explicitly set the headless property to `true` or `false`.
              newOptions.headless = headless;
            } else {
              const effectNameSlug = effectName.toLowerCase();

              // If the queries stem from multiple different data sources, the type of
              // query that is being executed determines whether it stems from a headless
              // source, or not.
              //
              // Specifically, read queries are never headless because they always stem
              // from the server (where the database is located), whereas write queries
              // are always headless because they always stem from the client (where the
              // user expressing the intent is located). The only exception to this rule
              // is handled above, if `headless` is defined explicitly.
              newOptions.headless = WRITE_QUERY_TYPES.some((queryType) => {
                return effectNameSlug.endsWith(queryType);
              });
            }

            const finalArgs = [...argsBeforeLast, { ...newOptions, ...lastArg }];

            return effectFunction(...finalArgs);
          },
        ],
      );

      return [fileName.replace('.ts', ''), Object.fromEntries(extendedEffectEntries)];
    },
  );

  return Object.fromEntries(list);
};
