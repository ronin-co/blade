import type { BeforeGetHook } from 'ronin/types';

import type { ServerContext } from '../context';
import type { DataHookOptions, DataHooks, DataHooksList } from '../types';

/**
 * Convert a list of data hook files to data hooks that can be passed to RONIN.
 *
 * @param serverContext - A partial server context object.
 * @param hooks - The data hooks that should be prepared for invocation.
 * @param config - Additional configuration options.
 *
 * @returns Data hooks ready to be passed to RONIN.
 */
export const prepareHooks = (
  serverContext: Partial<ServerContext> &
    Pick<ServerContext, 'cookies' | 'userAgent' | 'geoLocation' | 'languages' | 'url'>,
  hooks: DataHooksList,
  config?: {
    headless?: boolean;
  },
): DataHooksList => {
  const options: DataHookOptions = {
    cookies: serverContext.cookies,
    navigator: {
      userAgent: serverContext.userAgent,
      geoLocation: serverContext.geoLocation,
      languages: serverContext.languages,
    },
    location: new URL(serverContext.url),
    headless: Boolean(config?.headless),
  };

  const list = Object.entries(hooks || {}).map(
    ([fileName, hookList]): [string, DataHooks] => {
      // For every data hook, update the existing options argument to provide additional
      // options that are specific to BLADE.
      const extendedHookEntries = Object.entries(hookList).map(([key, hook]) => [
        key,
        // This handles data hooks of all types, but for the sake of being able to parse
        // the arguments of the original data hook type, we're using only the type of
        // `before*` data hooks.
        (...args: Parameters<BeforeGetHook>) => {
          const argsBeforeLast = args.slice(0, -1);
          const lastArg = args.at(-1) as object;

          const finalArgs = [...argsBeforeLast, { ...options, ...lastArg }];

          return hook(...finalArgs);
        },
      ]);

      return [fileName.replace('.ts', ''), Object.fromEntries(extendedHookEntries)];
    },
  );

  return Object.fromEntries(list);
};
