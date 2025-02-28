import type { AfterGetHook } from 'ronin/types';

import type { ServerContext } from '../context';
import type { DataHookOptions, DataHooks, DataHooksList } from '../types';

/**
 * Convert a list of data hook files to data hooks that can be passed to RONIN.
 *
 * @param serverContext - A partial server context object.
 * @param hooks - The data hooks that should be prepared for invocation.
 * @param dataSelector - A custom selector for which the queries should be run.
 *
 * @returns Data hooks ready to be passed to RONIN.
 */
export const prepareHooks = (
  serverContext: Partial<ServerContext> &
    Pick<ServerContext, 'cookies' | 'userAgent' | 'geoLocation' | 'languages' | 'url'>,
  hooks: DataHooksList,
  config?: {
    dataSelector?: string;
    fromHeadlessAPI?: boolean;
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
    fromRoninDashboard: Boolean(config?.dataSelector),
    fromHeadlessAPI: Boolean(config?.fromHeadlessAPI),
  };

  const list = Object.entries(hooks || {}).map(
    ([fileName, hookList]): [string, DataHooks] => {
      // For every hook, provide an additional argument that contains the `options`
      // object defined above. This allows us to pass on BLADE-specific arguments to the
      // data hooks.
      const extendedHookEntries = Object.entries(hookList).map(([key, hook]) => [
        key,
        // This handles data hooks of all types, but for the sake of being able to parse
        // the arguments of the original data hook type, we're using only the type of
        // `after*` data hooks.
        async (...args: Parameters<AfterGetHook>) => hook(...args, options),
      ]);

      return [fileName.replace('.ts', ''), Object.fromEntries(extendedHookEntries)];
    },
  );

  return Object.fromEntries(list);
};
