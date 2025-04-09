import type { BeforeGetHook } from 'ronin/types';

import type { ServerContext } from '../context';
import type { DataHookOptions, DataHooks, DataHooksList } from '../types';

/**
 * Convert a list of data hook files to data hooks that can be passed to RONIN.
 *
 * @param serverContext - A partial server context object.
 * @param hooks - The data hooks that should be prepared for invocation.
 * @param headless - Whether the hooks are being run for a headless source, meaning the
 * application's browser client or REST API. If queries from multiple different sources
 * are provided, this argument should be omitted.
 *
 * @returns Data hooks ready to be passed to RONIN.
 */
export const prepareHooks = (
  serverContext: Partial<ServerContext> &
    Pick<ServerContext, 'cookies' | 'userAgent' | 'geoLocation' | 'languages' | 'url'>,
  hooks: DataHooksList,
  headless?: boolean,
): DataHooksList => {
  const options: Partial<DataHookOptions> = {
    cookies: serverContext.cookies,
    navigator: {
      userAgent: serverContext.userAgent,
      geoLocation: serverContext.geoLocation,
      languages: serverContext.languages,
    },
    location: new URL(serverContext.url),
  };

  const list = Object.entries(hooks || {}).map(
    ([fileName, hookList]): [string, DataHooks] => {
      // For every data hook, update the existing options argument to provide additional
      // options that are specific to BLADE.
      const extendedHookEntries = Object.entries(hookList).map(
        ([hookName, hookFunction]) => [
          hookName,
          // This handles data hooks of all types, but for the sake of being able to parse
          // the arguments of the original data hook type, we're using only the type of
          // `before*` data hooks.
          (...args: Parameters<BeforeGetHook>) => {
            const argsBeforeLast = args.slice(0, -1);
            const lastArg = args.at(-1) as object;

            // Create an object of options that are specific to the current hook function,
            // in order to avoid modifying the global object.
            const newOptions = { ...options };

            if (typeof headless === 'boolean') {
              // If all queries provided to the data hooks stem from the same data source,
              // we can explicitly set the headless property to `true` or `false`.
              newOptions.headless = headless;
            } else {
              // If the queries stem from multiple different data sources, the type of
              // query that is being executed determines whether it stems from a headless
              // source, or not.
              //
              // Specifically, read queries are never headless because they always stem
              // from the server (where the database is located), whereas write queries are
              // always headless because they always stem from the client (where the user
              // expressing the intent is located).
              newOptions.headless = false;
            }

            const finalArgs = [...argsBeforeLast, { ...newOptions, ...lastArg }];

            return hookFunction(...finalArgs);
          },
        ],
      );

      return [fileName.replace('.ts', ''), Object.fromEntries(extendedHookEntries)];
    },
  );

  return Object.fromEntries(list);
};
