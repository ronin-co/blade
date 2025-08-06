import type { BeforeGetTrigger, QueryHandlerOptions } from 'blade-client/types';
import {
  type AddQuery,
  type CountQuery,
  type GetQuery,
  QUERY_SYMBOLS,
  type Query,
  type RemoveQuery,
  type SetQuery,
} from 'blade-compiler';
import { getSyntaxProxy } from 'blade-syntax/queries';
import {
  isStorableObject,
  runQueries as runQueriesWithStorageAndTriggers,
} from 'ronin/utils';

import type { ServerContext } from '@/private/server/context';
import type {
  ClientTriggerOptions,
  TriggerOptions as NewTriggerOptions,
  Triggers,
  TriggersList,
} from '@/private/server/types';
import { WRITE_QUERY_TYPES } from '@/private/server/utils/constants';

interface ExtendedQueryHandlerOptions extends QueryHandlerOptions {
  /**
   * Whether the query should flush the UI after execution.
   *
   * @default false
   */
  flushUI?: boolean;
}

/**
 * Convert a list of trigger files to triggers that can be passed to RONIN.
 *
 * @param serverContext - A partial server context object.
 * @param triggers - The triggers that should be prepared for invocation.
 * @param headless - Whether the triggers are being run for a headless source, meaning the
 * application's browser client or REST API. If queries from multiple different sources
 * are provided, this argument should be omitted.
 *
 * @returns Triggers ready to be passed to RONIN.
 */
export const prepareTriggers = (
  serverContext: Partial<ServerContext> &
    Pick<ServerContext, 'cookies' | 'userAgent' | 'geoLocation' | 'languages' | 'url'>,
  triggers: TriggersList,
  headless?: boolean,
): TriggersList => {
  const callback = async (
    defaultQuery: Query,
    queryOptions?: ExtendedQueryHandlerOptions,
  ) => {
    const query = (defaultQuery as Record<typeof QUERY_SYMBOLS.QUERY, Query>)[
      QUERY_SYMBOLS.QUERY
    ];
    const queries = 'statement' in query ? { statements: [query.statement] } : [query];

    if ('statements' in queries)
      throw new Error(
        '`statements` is not supported in Blade queries. Use `Query` objects instead.',
      );

    if (queryOptions?.database)
      throw new Error('Custom databases are not currently supported in Blade queries.');

    const [results] = await runQueriesWithStorageAndTriggers(queries, queryOptions ?? {});

    if (queryOptions?.flushUI === true) {
      if (serverContext.flushUI) {
        await serverContext
          .flushUI()
          .catch((err) => console.error('[BLADE] flushUI failed:', err));
      } else {
        console.warn('[BLADE] `flushUI` is not available in the current server context.');
      }
    }

    return results;
  };

  // Ensure that storable objects are retained as-is instead of being serialized.
  const replacer = (value: unknown) => (isStorableObject(value) ? value : undefined);

  const options: Partial<NewTriggerOptions> = {
    client: {
      get: getSyntaxProxy<GetQuery>({
        root: `${QUERY_SYMBOLS.QUERY}.get`,
        callback,
        replacer,
      }),
      set: getSyntaxProxy<SetQuery>({
        root: `${QUERY_SYMBOLS.QUERY}.set`,
        callback,
        replacer,
      }),
      add: getSyntaxProxy<AddQuery>({
        root: `${QUERY_SYMBOLS.QUERY}.add`,
        callback,
        replacer,
      }),
      remove: getSyntaxProxy<RemoveQuery>({
        root: `${QUERY_SYMBOLS.QUERY}.remove`,
        callback,
        replacer,
      }),
      count: getSyntaxProxy<CountQuery, number>({
        root: `${QUERY_SYMBOLS.QUERY}.count`,
        callback,
        replacer,
      }),
    },
    cookies: serverContext.cookies,
    navigator: {
      userAgent: serverContext.userAgent,
      geoLocation: serverContext.geoLocation,
      languages: serverContext.languages,
    },
    location: new URL(serverContext.url),
    flushUI: serverContext.flushUI,
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

            if (typeof headless === 'boolean') {
              // If all queries provided to the triggers stem from the same data source,
              // we can explicitly set the headless property to `true` or `false`.
              newOptions.headless = headless;
            } else {
              const triggerNameSlug = triggerName.toLowerCase();

              // If the RONIN client insists that the query was generated implicitly by
              // an trigger (`implicit: true`), we don't need to perform further checks.
              //
              // Otherwise, if the client insists that the query was not generated by an
              // trigger (`implicit: false`), we need to check if the query is headless
              // based on Blade's own query primitives.
              if (oldOptions.implicit === true) {
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

  return Object.fromEntries(list);
};
