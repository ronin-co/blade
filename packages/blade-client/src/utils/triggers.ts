import { createSyntaxFactory } from '@/src/index';
import {
  type QueriesPerDatabase,
  type ResultsPerDatabase,
  runQueries,
} from '@/src/queries';
import type {
  FormattedResults,
  QueryHandlerOptions,
  RecursivePartial,
} from '@/src/types/utils';
import { WRITE_QUERY_TYPES } from '@/src/utils/constants';
import { ClientError } from '@/src/utils/errors';
import { omit, toDashCase } from '@/src/utils/helpers';
import {
  type CombinedInstructions,
  DDL_QUERY_TYPES,
  QUERY_TYPES,
  QUERY_TYPES_READ,
  QUERY_TYPES_WRITE,
  type Query,
  type QuerySchemaType,
  type QueryType,
  type ResultRecord,
} from 'blade-compiler';

const EMPTY = Symbol('empty');

interface TriggerOptions {
  /** Whether the query was generated implicitly by an trigger. */
  implicit: boolean;
  /** An instance of the current client, which can be used for nested queries. */
  client: ReturnType<typeof createSyntaxFactory>;

  /** The model for which the query is being executed. */
  model?: string;
  /** The database for which the query is being executed. */
  database?: string;
  /** A function for keeping the worker alive as long as a promise is not resolved. */
  waitUntil?: QueryHandlerOptions['waitUntil'];
}

export type FilteredTriggerQuery<
  TType extends QueryType,
  TQuery extends CombinedInstructions = CombinedInstructions,
> = RecursivePartial<TQuery> &
  Pick<
    TQuery,
    TType extends 'count'
      ? never
      : TType extends 'add'
        ? 'to'
        : TType extends 'get'
          ? never
          : TType extends 'set'
            ? 'to'
            : TType extends 'remove'
              ? never
              : never
  >;

export type BeforeTriggerHandler<
  TType extends QueryType,
  TOptions extends object = object,
  TQuery extends FilteredTriggerQuery<TType> = FilteredTriggerQuery<TType>,
> = (
  query: TQuery,
  multipleRecords: boolean,
  options: TriggerOptions & TOptions,
) => Array<Query> | Promise<Array<Query>>;

export type DuringTriggerHandler<
  TType extends QueryType,
  TOptions extends object = object,
  TQuery extends FilteredTriggerQuery<TType> = FilteredTriggerQuery<TType>,
> = (
  query: TQuery,
  multipleRecords: boolean,
  options: TriggerOptions & TOptions,
) => TQuery | Promise<TQuery> | Query | Promise<Query>;

export type AfterTriggerHandler<
  TType extends QueryType,
  TOptions extends object = object,
  TQuery extends FilteredTriggerQuery<TType> = FilteredTriggerQuery<TType>,
> = (
  query: TQuery,
  multipleRecords: boolean,
  options: TriggerOptions & TOptions,
) => Array<Query> | Promise<Array<Query>>;

export type ResolvingTriggerHandler<
  TType extends QueryType,
  TOptions extends object = object,
  TSchema = unknown,
> = (
  query: FilteredTriggerQuery<TType>,
  multipleRecords: boolean,
  options: TriggerOptions & TOptions,
) => TSchema | Promise<TSchema>;

export type FollowingTriggerHandler<
  TType extends QueryType,
  TOptions extends object = object,
  TSchema = unknown,
> = (
  query: FilteredTriggerQuery<TType>,
  multipleRecords: boolean,
  beforeResult: TSchema,
  afterResult: TSchema,
  options: TriggerOptions & TOptions,
) => void | Promise<void>;

// The order of these types is important, as they determine the order in which
// triggers are run (the "trigger lifecycle").
const TRIGGER_TYPES = ['before', 'during', 'after', 'resolving', 'following'] as const;

type TriggerType = (typeof TRIGGER_TYPES)[number];

type TriggerKeys = (
  | { [K in QueryType]: `before${Capitalize<K>}` }
  | { [K in QueryType]: K }
  | { [K in QueryType]: `after${Capitalize<K>}` }
  | { [K in QueryType]: `resolving${Capitalize<K>}` }
  | { [K in QueryType]: `following${Capitalize<K>}` }
)[QueryType];

type TriggerList<TSchema = unknown> = {
  [K in TriggerKeys]?: K extends 'before' | `before${string}`
    ? BeforeTriggerHandler<QueryType>
    : K extends 'after' | `after${string}`
      ? AfterTriggerHandler<QueryType>
      : K extends 'resolving' | `resolving${string}`
        ? ResolvingTriggerHandler<QueryType, object, TSchema>
        : K extends 'following' | `following${string}`
          ? FollowingTriggerHandler<QueryType, object, TSchema>
          : DuringTriggerHandler<QueryType>;
};

export type Triggers<TSchema = unknown> = Record<string, TriggerList<TSchema>>;

export type BeforeGetTrigger = BeforeTriggerHandler<'get'>;
export type BeforeSetTrigger = BeforeTriggerHandler<'set'>;
export type BeforeAddTrigger = BeforeTriggerHandler<'add'>;
export type BeforeRemoveTrigger = BeforeTriggerHandler<'remove'>;
export type BeforeCountTrigger = BeforeTriggerHandler<'count'>;
export type BeforeCreateTrigger = BeforeTriggerHandler<'create'>;
export type BeforeAlterTrigger = BeforeTriggerHandler<'alter'>;
export type BeforeDropTrigger = BeforeTriggerHandler<'drop'>;

export type GetTrigger = DuringTriggerHandler<'get'>;
export type SetTrigger = DuringTriggerHandler<'set'>;
export type AddTrigger = DuringTriggerHandler<'add'>;
export type RemoveTrigger = DuringTriggerHandler<'remove'>;
export type CountTrigger = DuringTriggerHandler<'count'>;
export type CreateTrigger = DuringTriggerHandler<'create'>;
export type AlterTrigger = DuringTriggerHandler<'alter'>;
export type DropTrigger = DuringTriggerHandler<'drop'>;

export type AfterGetTrigger = AfterTriggerHandler<'get'>;
export type AfterSetTrigger = AfterTriggerHandler<'set'>;
export type AfterAddTrigger = AfterTriggerHandler<'add'>;
export type AfterRemoveTrigger = AfterTriggerHandler<'remove'>;
export type AfterCountTrigger = AfterTriggerHandler<'count'>;
export type AfterCreateTrigger = AfterTriggerHandler<'create'>;
export type AfterAlterTrigger = AfterTriggerHandler<'alter'>;
export type AfterDropTrigger = AfterTriggerHandler<'drop'>;

export type ResolvingGetTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'get',
  object,
  TSchema
>;
export type ResolvingSetTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'set',
  object,
  TSchema
>;
export type ResolvingAddTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'add',
  object,
  TSchema
>;
export type ResolvingRemoveTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'remove',
  object,
  TSchema
>;
export type ResolvingCountTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'count',
  object,
  TSchema
>;
export type ResolvingCreateTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'create',
  object,
  TSchema
>;
export type ResolvingAlterTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'alter',
  object,
  TSchema
>;
export type ResolvingDropTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'drop',
  object,
  TSchema
>;

export type FollowingGetTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'get',
  object,
  TSchema
>;
export type FollowingSetTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'set',
  object,
  TSchema
>;
export type FollowingAddTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'add',
  object,
  TSchema
>;
export type FollowingRemoveTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'remove',
  object,
  TSchema
>;
export type FollowingCountTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'count',
  object,
  TSchema
>;
export type FollowingCreateTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'create',
  object,
  TSchema
>;
export type FollowingAlterTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'alter',
  object,
  TSchema
>;
export type FollowingDropTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'drop',
  object,
  TSchema
>;

const getModel = (
  instruction: QuerySchemaType,
): {
  key: string;
  model: string;
  multipleRecords: boolean;
} => {
  const key = Object.keys(instruction)[0];

  let model = String(key);
  let multipleRecords = false;

  if (model.endsWith('s')) {
    model = model.substring(0, model.length - 1);
    multipleRecords = true;
  }

  return {
    key,
    // Convert camel case (e.g. `subscriptionItems`) into slugs
    // (e.g. `subscription-items`).
    model: toDashCase(model),
    multipleRecords,
  };
};

/**
 * Constructs the method name used for a particular type of trigger and query.
 * For example, if `triggerType` is "following" and `queryType` is "add", the
 * resulting method name would be `followingAdd`.
 *
 * @param triggerType - The type of trigger.
 * @param queryType - The type of query.
 *
 * @returns The method name constructed from the trigger and query types.
 */
const getMethodName = (triggerType: TriggerType, queryType: QueryType): string => {
  const capitalizedQueryType = queryType[0].toUpperCase() + queryType.slice(1);
  return triggerType === 'during' ? queryType : triggerType + capitalizedQueryType;
};

/**
 * Takes the result of a query and normalizes it to an array, to avoid
 * developers having to conditionally support both arrays and objects inside
 * the triggers. Furthermore, the result is cloned to allow for modifying it
 * within triggers without affecting the original query result that is being
 * returned from the client.
 *
 * @param result - The result of a query.
 *
 * @returns The normalized result of a query.
 */
const normalizeResults = (result: unknown) => {
  const value = Array.isArray(result) ? result : result === EMPTY ? [] : [result];
  return structuredClone(value);
};

export interface TriggerContext {
  triggerType: TriggerType;
  queryType: QueryType;
  queryModel: string;
}

/**
 * Invokes a particular trigger (such as `followingAdd`) and handles its output.
 * In the case of an "before" trigger, a query is returned from the trigger, which
 * must replace the original query in the list of queries. For a "resolving" trigger,
 * the results of the query are returned and must therefore be merged into the
 * final list of results. In the case of an "following" trigger, nothing must be done
 * because no output is returned by the trigger.
 *
 * @param triggers - A list of triggers to use.
 * @param triggerType - The type of trigger.
 * @param definition - The definition and other details of a query that is being run.
 * @param options - A list of options to change how the queries are executed.
 *
 * @returns The modified query and its results, if any are available.
 */
const invokeTriggers = async (
  triggers: NonNullable<QueryHandlerOptions['triggers']>,
  triggerType: TriggerType,
  definition: {
    query: Query;
    resultBefore?: unknown;
    resultAfter?: unknown;
  },
  options: Omit<TriggerOptions, 'model'>,
): Promise<{
  /** A list of queries provided by the trigger. */
  queries?: Array<Query>;
  /** The result of a query provided by the trigger. */
  result?: FormattedResults<unknown>[number] | symbol;
}> => {
  const { database, client, waitUntil, implicit } = options;
  const { query } = definition;

  const queryType = Object.keys(query)[0] as QueryType;

  let queryModel: string;
  let queryModelDashed: string;
  let multipleRecords: boolean;

  let oldInstruction: CombinedInstructions | undefined;

  // If the provided query interacts with a model, the query instructions must be
  // determined in a special way, since Data Definition Language (DDL) queries have a
  // different structure than regular Data Manipulation Language (DML) queries.
  if (DDL_QUERY_TYPES.includes(queryType as (typeof DDL_QUERY_TYPES)[number])) {
    queryModel = queryModelDashed = 'model';
    multipleRecords = false;
    oldInstruction = query[queryType] as CombinedInstructions;
  } else {
    const queryInstructions = query[queryType] as QuerySchemaType;
    ({
      key: queryModel,
      model: queryModelDashed,
      multipleRecords,
    } = getModel(queryInstructions));

    oldInstruction = queryInstructions[queryModel];
  }

  // If the triggers are being executed for a custom database, all triggers must be located
  // inside a file named `sink.ts`, which catches the queries for all other databases.
  //
  // If the triggers are *not* being executed for a custom database, the trigger file name
  // matches the model that is being addressed by the query.
  const triggerFile = database ? 'sink' : queryModelDashed;
  const triggersForModel = triggers[triggerFile];
  const triggerName = getMethodName(triggerType, queryType);

  // If `oldInstruction` is falsy (e.g. `null`), we want to default to `{}`.
  // This would happen in cases where all records of a particular model are
  // retrieved. For example, the query `get.members();` would trigger this.
  //
  // It's important to provide an object to triggers, as people might otherwise
  // try to set properties on a value that's not an object, which would cause
  // the trigger to crash with an exception.
  //
  // It's also extremely important to clone both of the variables below, as the
  // triggers will otherwise modify the original that was passed from the outside.
  const queryInstruction = oldInstruction
    ? structuredClone<CombinedInstructions>(oldInstruction as CombinedInstructions)
    : ({} as CombinedInstructions);

  if (triggersForModel && triggerName in triggersForModel) {
    const trigger = triggersForModel[triggerName as keyof typeof triggersForModel];

    const triggerOptions = {
      implicit,
      client,
      waitUntil,
      ...(triggerFile === 'sink' ? { model: queryModel, database } : {}),
    };

    // For triggers of type "following" (such as `followingAdd`), we want to pass
    // special function arguments that contain the value of the affected records
    // before and after the query was executed.
    const triggerResult = await (triggerType === 'following'
      ? (trigger as FollowingTriggerHandler<QueryType, object, unknown>)(
          queryInstruction,
          multipleRecords,
          normalizeResults(definition.resultBefore),
          normalizeResults(definition.resultAfter),
          triggerOptions,
        )
      : (trigger as DuringTriggerHandler<QueryType> | ResolvingTriggerHandler<QueryType>)(
          queryInstruction,
          multipleRecords,
          triggerOptions,
        ));

    // If the trigger returned multiple queries that should be run before the original query,
    // we want to return those queries.
    if (triggerType === 'before') {
      return { queries: triggerResult as Array<Query> };
    }

    // If the trigger returned a query, we want to replace the original query with
    // the one returned by the trigger.
    if (triggerType === 'during') {
      const result = triggerResult as null | Query | CombinedInstructions;
      let newQuery: Query = query;

      // If a full query was returned by the "before" trigger, use the query as-is.
      if (result && QUERY_TYPES.some((type) => type in result)) {
        newQuery = result as Query;
      }
      // In the majority of cases, however, only the query instructions are returned, in
      // which case we need to construct a new query with those instructions.
      else {
        newQuery = {
          [queryType]: {
            [queryModel]: result as CombinedInstructions,
          },
        };
      }

      return { queries: [newQuery] };
    }

    // If the trigger returned multiple queries that should be run after the original query,
    // we want to return those queries.
    if (triggerType === 'after') {
      return { queries: triggerResult as Array<Query> };
    }

    // If the trigger returned a record (or multiple), we want to set the query's
    // result to the value returned by the trigger.
    if (triggerType === 'resolving') {
      const result = triggerResult as FormattedResults<unknown>[number];
      return { queries: [], result };
    }

    // In the case of "following" triggers, we don't need to do anything, because they
    // are run asynchronously and aren't expected to return anything.
  }

  return { queries: [], result: EMPTY };
};

/**
 * Executes queries and also invokes any potential triggers (such as `followingAdd`)
 * that might have been provided as part of `options.triggers`.
 *
 * @param queries - A list of queries to execute.
 * @param options - A list of options to change how the queries are executed. To
 * run triggers, the `options.triggers` property must contain a map of triggers.
 *
 * @returns The results of the queries that were passed.
 */
export const runQueriesWithTriggers = async <T extends ResultRecord>(
  queries: QueriesPerDatabase,
  options: QueryHandlerOptions = {},
): Promise<ResultsPerDatabase<T>> => {
  const { triggers, waitUntil, requireTriggers, implicit: implicitRoot } = options;

  const triggerErrorType = requireTriggers !== 'all' ? ` ${requireTriggers}` : '';
  const triggerError = new ClientError({
    message: `Please define "during" triggers for the provided${triggerErrorType} queries.`,
    code: 'TRIGGER_REQUIRED',
  });

  // If no triggers were provided, we can just run all the queries and return the results.
  if (!triggers) {
    if (requireTriggers) throw triggerError;
    return runQueries<T>(queries, options);
  }

  // If triggers were provided, intialize a new client instance that can be used for
  // nested queries within triggers.
  //
  // We are stripping the `requireTriggers` option, because no triggers should be
  // required for queries that are nested into triggers.
  const client = createSyntaxFactory({
    ...omit(options, ['requireTriggers']),
    implicit: true,
  });

  if (typeof process === 'undefined' && !waitUntil) {
    let message = 'In the case that the "ronin" package receives a value for';
    message += ' its `triggers` option, it must also receive a value for its';
    message += ' `waitUntil` option. This requirement only applies when using';
    message += ' an edge runtime and ensures that the edge worker continues to';
    message += ' execute until all "following" triggers have been executed.';

    throw new Error(message);
  }

  let queryList: Array<
    QueriesPerDatabase[number] & {
      result: FormattedResults<T>[number] | symbol;
      /** Whether the query is a diff query for another query. */
      diffForIndex?: number;
      /**
       * Whether the query is a implicit query for another query, and was therefore
       * generated implicitly by an trigger, instead of being explicitly passed to the
       * client from the outside.
       */
      implicit?: boolean;
    }
  > = queries.map(({ query, database }) => ({
    query,
    result: EMPTY,
    database,
  }));

  // Invoke `beforeAdd`, `beforeGet`, `beforeSet`, `beforeRemove`, and `beforeCount`.
  await Promise.all(
    queryList.map(async ({ query, database, implicit }, index) => {
      const triggerResults = await invokeTriggers(
        triggers,
        'before',
        { query },
        { database, client, waitUntil, implicit: Boolean(implicitRoot || implicit) },
      );

      const queriesToInsert = triggerResults.queries!.map((query) => ({
        query,
        result: EMPTY,
        database,
        implicit: true,
      }));

      queryList.splice(index, 0, ...queriesToInsert);
    }),
  );

  // Invoke `add`, `get`, `set`, `remove`, and `count`.
  await Promise.all(
    queryList.map(async ({ query, database, implicit }, index) => {
      const triggerResults = await invokeTriggers(
        triggers,
        'during',
        { query },
        { database, client, waitUntil, implicit: Boolean(implicitRoot || implicit) },
      );

      if (triggerResults.queries && triggerResults.queries.length > 0) {
        queryList[index].query = triggerResults.queries[0];
        return;
      }

      // If "during" triggers are required for the query type of the current query,
      // we want to throw an error to prevent the query from being executed.
      if (requireTriggers) {
        const queryType = Object.keys(query)[0] as QueryType;
        const requiredTypes: ReadonlyArray<QueryType> =
          requireTriggers === 'read'
            ? QUERY_TYPES_READ
            : requireTriggers === 'write'
              ? QUERY_TYPES_WRITE
              : QUERY_TYPES;

        if (requiredTypes.includes(queryType)) throw triggerError;
      }
    }),
  );

  // Invoke `afterAdd`, `afterGet`, `afterSet`, `afterRemove`, and `afterCount`.
  await Promise.all(
    queryList.map(async ({ query, database, implicit }, index) => {
      const triggerResults = await invokeTriggers(
        triggers,
        'after',
        { query },
        { database, client, waitUntil, implicit: Boolean(implicitRoot || implicit) },
      );

      const queriesToInsert = triggerResults.queries!.map((query) => ({
        query,
        result: EMPTY,
        database,
        implicit: true,
      }));

      queryList.splice(index + 1, 0, ...queriesToInsert);
    }),
  );

  // If triggers are enabled, we want to send a separate `get` query for every `set`
  // and `alter` query (in the same transaction), so that we can provide the triggers
  // with a "before and after" of the modified records.
  //
  // The version of the record *after* the modification is already available without the
  // extra `get` query, since `set` queries return the modified record afterward, but in
  // order to get the version of the record *before* the modification, we need a separate
  // query of type `get`.
  queryList = queryList.flatMap((details, index) => {
    const { query, database } = details;

    if (query.set || query.alter) {
      let newQuery: Query | undefined;

      if (query.set) {
        const modelSlug = Object.keys(query.set!)[0];

        newQuery = {
          get: {
            [modelSlug]: {
              with: query.set![modelSlug].with,
            },
          },
        };
      } else {
        newQuery = {
          list: {
            model: query.alter!.model,
          },
        };
      }

      const diffQuery = {
        query: newQuery,
        diffForIndex: index + 1,
        result: EMPTY,
        database,
      };

      return [diffQuery, details];
    }

    return [details];
  });

  // Invoke `resolvingGet`, `resolvingSet`, `resolvingAdd`, `resolvingRemove`,
  // and `resolvingCount`.
  await Promise.all(
    queryList.map(async ({ query, database, implicit }, index) => {
      const triggerResults = await invokeTriggers(
        triggers,
        'resolving',
        { query },
        { database, client, waitUntil, implicit: Boolean(implicitRoot || implicit) },
      );
      queryList[index].result = triggerResults.result as FormattedResults<T>[number];
    }),
  );

  const queriesWithoutResults = queryList
    .map((query, index) => ({ ...query, index }))
    .filter((query) => query.result === EMPTY);

  // If queries are remaining that don't have any results that were provided by above by
  // triggers, we need to run those queries against the database.
  if (queriesWithoutResults.length > 0) {
    const resultsFromDatabase = await runQueries<T>(queriesWithoutResults, options);

    // Assign the results from the database to the list of queries.
    for (let index = 0; index < resultsFromDatabase.length; index++) {
      const query = queriesWithoutResults[index];
      const result = resultsFromDatabase[index].result;

      queryList[query.index].result = result;
    }
  }

  // Asynchronously invoke `followingAdd`, `followingSet`, `followingRemove`,
  // `followingCreate`, `followingAlter`, and `followingDrop`.
  for (let index = 0; index < queryList.length; index++) {
    const { query, result, database, implicit } = queryList[index];
    const queryType = Object.keys(query)[0] as QueryType;

    // "following" triggers should only fire for writes — not reads.
    if (!(WRITE_QUERY_TYPES as ReadonlyArray<string>).includes(queryType)) continue;

    const diffMatch = queryList.find((item) => item.diffForIndex === index);

    let resultBefore = diffMatch ? diffMatch.result : EMPTY;
    let resultAfter = result;

    // For queries of type "remove" and "drop", we want to set `resultBefore` to the
    // result of the query (which contains the record), because the record will no longer
    // exist after the query has been executed, so it wouldn't make sense to expose the
    // record as `resultAfter` in the triggers.
    if (queryType === 'remove' || queryType === 'drop') {
      resultBefore = result;
      resultAfter = EMPTY;
    }

    // Run the actual trigger functions.
    const promise = invokeTriggers(
      triggers,
      'following',
      { query, resultBefore, resultAfter },
      { database, client, waitUntil, implicit: Boolean(implicitRoot || implicit) },
    );

    // The result of the trigger should not be made available, otherwise
    // developers might start relying on it. Only errors should be propagated.
    const clearPromise = promise.then(
      () => {},
      (error) => Promise.reject(error),
    );

    // If the configuration option for extending the lifetime of the edge
    // worker invocation was passed, provide it with the resulting promise of
    // the trigger invocation above. This will ensure that the worker will
    // continue to be executed until all of the asynchronous actions
    // (non-awaited promises) have been resolved.
    if (waitUntil) waitUntil(clearPromise);
  }

  // Filter the list of queries to remove any potential queries used for "diffing"
  // (retrieving the previous value of a record) and any potential queries resulting from
  // "before" or "after" triggers. Then return only the results of the queries.
  return queryList
    .filter(
      (query) =>
        typeof query.diffForIndex === 'undefined' &&
        typeof query.implicit === 'undefined',
    )
    .map(({ result, database }) => ({
      result: result as FormattedResults<T>[number],
      database,
    }));
};
