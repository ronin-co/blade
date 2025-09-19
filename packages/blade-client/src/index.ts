import { runQueriesWithStorageAndTriggers } from '@/src/queries';
import { isStorableObject } from '@/src/storage';
import type { PromiseTuple, QueryHandlerOptions } from '@/src/types/utils';
import { queriesHandler, queryHandler } from '@/src/utils/handlers';
import { mergeOptions } from '@/src/utils/helpers';
import {
  type AddQuery,
  type AlterQuery,
  type CountQuery,
  type CreateQuery,
  type DropQuery,
  type GetQuery,
  type ListQuery,
  type ModelField,
  type ModelIndex,
  type ModelPreset,
  QUERY_SYMBOLS,
  type Query,
  type RemoveQuery,
  type SetQuery,
  type Statement,
} from 'blade-compiler';
import {
  type DeepCallable,
  type SyntaxItem,
  getBatchProxy,
  getBatchProxySQL,
  getSyntaxProxy,
  getSyntaxProxySQL,
} from 'blade-syntax/queries';
import type { Model } from 'blade-syntax/schema';

/**
 * Creates a syntax factory for generating and executing queries.
 *
 * @param options - An optional object of options for the query execution.
 *
 * Alternatively, a function that returns the object may be provided instead, which is
 * useful for cases in which the config must be generated dynamically whenever a query
 * is executed.
 *
 * @returns An object with methods for generating and executing different types
 * of queries.
 *
 * ### Usage
 * ```typescript
 * const { get, set, add, remove, count } = createSyntaxFactory({
 *   token: '...'
 * });
 *
 * await get.accounts();
 *
 * await set.account({
 *   with: {
 *     email: 'mike@gmail.com',
 *   },
 *   to: {
 *     status: 'active',
 *   },
 * });
 *
 * await add.account({ with: { email: 'mike@gmail.com' } });
 *
 * await remove.accounts.with.emailVerified.notBeing(true);
 *
 * await count.accounts();
 *
 * // Execute a batch of operations
 * const batchResult = await batch(() => [
 *   get.accounts(),
 *   get.account.with.email('mike@gmail.com')
 * ]);
 * ```
 */
export const createSyntaxFactory = (
  options: QueryHandlerOptions | (() => QueryHandlerOptions),
): {
  get: DeepCallable<GetQuery>;
  set: DeepCallable<SetQuery>;
  add: DeepCallable<AddQuery>;
  remove: DeepCallable<RemoveQuery>;
  count: DeepCallable<CountQuery, number>;

  list: DeepCallable<ListQuery>;
  create: DeepCallable<CreateQuery, Model>;
  alter: DeepCallable<AlterQuery, Model | ModelField | ModelIndex | ModelPreset>;
  drop: DeepCallable<DropQuery, Model>;

  batch: <T extends [Promise<any>, ...Array<Promise<any>>] | Array<Promise<any>>>(
    operations: () => T,
    queryOptions?: Record<string, unknown>,
  ) => Promise<PromiseTuple<T>>;

  sql: (strings: TemplateStringsArray, ...values: Array<unknown>) => Promise<any>;
  sqlBatch: <T extends [Promise<any>, ...Array<Promise<any>>] | Array<Promise<any>>>(
    operations: () => T,
    queryOptions?: Record<string, unknown>,
  ) => Promise<PromiseTuple<T>>;
} => {
  const callback = async (defaultQuery: Query, queryOptions?: QueryHandlerOptions) => {
    const finalOptions = mergeOptions(options, queryOptions);

    const query = defaultQuery as Record<typeof QUERY_SYMBOLS.QUERY, Query>;
    const finalQuery = query[QUERY_SYMBOLS.QUERY];

    return (await finalOptions.callback([finalQuery], finalOptions))[0];
  };

  // Ensure that storable objects are retained as-is instead of being serialized.
  const replacer = (value: unknown) => (isStorableObject(value) ? value : undefined);

  return {
    // Query types for interacting with records.
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

    // Query types for interacting with the database schema.
    list: getSyntaxProxy<ListQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.list`,
      callback,
      replacer,
    }),
    create: getSyntaxProxy<CreateQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.create`,
      callback,
      replacer,
    }),
    alter: getSyntaxProxy<AlterQuery, Model | ModelField | ModelIndex | ModelPreset>({
      root: `${QUERY_SYMBOLS.QUERY}.alter`,
      callback,
      replacer,
    }),
    drop: getSyntaxProxy<DropQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.drop`,
      callback,
      replacer,
    }),

    // Function for executing a transaction containing multiple queries.
    batch: <T extends [Promise<any>, ...Array<Promise<any>>] | Array<Promise<any>>>(
      operations: () => T,
      queryOptions?: Record<string, unknown>,
    ): Promise<PromiseTuple<T>> => {
      const batchOperations = operations as unknown as () => Array<SyntaxItem<Query>>;
      const queries = getBatchProxy(batchOperations).map(({ structure }) => structure);
      const finalOptions = mergeOptions(options, queryOptions);

      return finalOptions.callback(queries, finalOptions) as Promise<PromiseTuple<T>>;
    },

    sql: getSyntaxProxySQL({
      callback: (statement) => queryHandler({ statement }, mergeOptions(options, {})),
    }),

    sqlBatch: <T extends [Promise<any>, ...Array<Promise<any>>] | Array<Promise<any>>>(
      operations: () => T,
      queryOptions?: Record<string, unknown>,
    ): Promise<PromiseTuple<T>> => {
      const batchOperations = operations as unknown as () => Array<Statement>;
      const statements = getBatchProxySQL(batchOperations);
      const finalOptions = mergeOptions(options, queryOptions);

      return queriesHandler({ statements }, finalOptions) as Promise<PromiseTuple<T>>;
    },
  };
};

const factory = createSyntaxFactory({});

export const get = factory.get as DeepCallable<GetQuery>;
export const set = factory.set as DeepCallable<SetQuery>;
export const add = factory.add as DeepCallable<AddQuery>;
export const remove = factory.remove as DeepCallable<RemoveQuery>;
export const count = factory.count as DeepCallable<CountQuery, number>;

export const list = factory.list as DeepCallable<ListQuery>;
export const create = factory.create as DeepCallable<CreateQuery, Model>;
export const alter = factory.alter as DeepCallable<
  AlterQuery,
  Model | ModelField | ModelIndex | ModelPreset
>;
export const drop = factory.drop as DeepCallable<DropQuery, Model>;

export const batch = factory.batch as <
  T extends [Promise<any>, ...Array<Promise<any>>] | Array<Promise<any>>,
>(
  operations: () => T,
  queryOptions?: Record<string, unknown>,
) => Promise<PromiseTuple<T>>;

export const sql = factory.sql;
export const sqlBatch = factory.sqlBatch;

export const runQueries = runQueriesWithStorageAndTriggers;

export default createSyntaxFactory;
