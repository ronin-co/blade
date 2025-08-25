import {
  type Query,
  type RegularResult,
  type Result,
  type ResultRecord,
  type Statement,
  Transaction,
} from 'blade-compiler';
import { Hive } from 'hive';
import { RemoteStorage } from 'hive/remote-storage';

import { processStorableObjects, uploadStorableObjects } from '@/src/storage';
import type {
  ExpandedFormattedResult,
  FormattedResults,
  QueryHandlerOptions,
  QueryResponse,
  RegularFormattedResult,
} from '@/src/types/utils';
import { WRITE_QUERY_TYPES } from '@/src/utils/constants';
import { getResponseBody } from '@/src/utils/errors';
import { formatDateFields, validateToken } from '@/src/utils/helpers';
import { runQueriesWithTriggers } from '@/src/utils/triggers';

interface RequestPayload {
  queries?: Array<Query>;
  nativeQueries?: Array<{ query: string; values: Array<unknown> }>;
}

type RequestBody = RequestPayload | Record<string, RequestPayload>;

export type QueriesPerDatabase = Array<{ query: Query; database?: string }>;
type StatementsPerDatabase = Array<{ statement: Statement; database?: string }>;

export type ResultsPerDatabase<T> = Array<{
  result: FormattedResults<T>[number];
  database?: string;
}>;

/**
 * Run a set of given queries.
 *
 * @param queries - A list of RONIN queries or SQL statements to execute.
 * @param options - `QueryHandlerOptions` object containing options passed to
 * the internal `fetch` function.
 *
 * @returns Promise resolving the queried data.
 */
export const runQueries = async <T extends ResultRecord>(
  queries: QueriesPerDatabase | StatementsPerDatabase,
  options: QueryHandlerOptions = {},
): Promise<ResultsPerDatabase<T>> => {
  // Ensure that a token is present. We must only perform this check if there is a
  // guarantee that actual queries must be executed. For example, if the client is
  // initialized with triggers that run all the queries using a different data source,
  // we don't want to require a token.
  validateToken(options);

  if (options.models) {
    const rawQueries = queries
      .filter((item) => 'query' in item)
      .map((item) => item.query);

    const transaction = new Transaction(rawQueries, { models: options.models });
    const rawStatements = transaction.statements.map((item) => {
      return { sql: item.statement, params: item.params as Array<string> };
    });

    const hive = new Hive({
      storage: ({ logger, events }) =>
        new RemoteStorage({
          logger,
          events,
          remote: 'https://db.ronin.co',
          token: options.token,
        }),
    });

    const database = await hive.get({ type: 'database', id: 'default' });
    const results = await database.query(rawStatements);
    const rawResults = results.map((result) => result.rows);

    const usableResults = transaction.formatResults(rawResults).map((result) => {
      if ('record' in result) {
        const { modelFields, ...rest } = result;
        return { ...rest, schema: modelFields };
      }

      if ('records' in result) {
        const { modelFields, ...rest } = result;
        return { ...rest, schema: modelFields };
      }

      return result;
    });

    const finalResults = formatResults<T>(usableResults as Array<Result<T>>);

    return finalResults.map((result) => ({ result }));
  }

  let hasWriteQuery: boolean | null = null;
  let hasSingleQuery = true;

  const operations = queries.reduce(
    (acc, details) => {
      const { database = 'default' } = details;
      if (!acc[database]) acc[database] = {};

      // If a database is being selected that isn't the default database, that means a
      // different format should be chosen for the request body.
      if (database !== 'default') hasSingleQuery = false;

      if ('query' in details) {
        const { query } = details;

        if (!acc[database].queries) acc[database].queries = [];
        acc[database].queries.push(query);

        const queryType = Object.keys(query)[0];
        hasWriteQuery =
          hasWriteQuery ||
          (WRITE_QUERY_TYPES as ReadonlyArray<string>).includes(queryType);

        return acc;
      }

      const { statement } = details;
      if (!acc[database].nativeQueries) acc[database].nativeQueries = [];

      acc[database].nativeQueries.push({
        query: statement.statement,
        values: statement.params,
      });

      return acc;
    },
    {} as Record<string, RequestPayload>,
  );

  const requestBody: RequestBody = hasSingleQuery ? operations.default : operations;

  // Runtimes like Cloudflare Workers don't support `cache` yet.
  const hasCachingSupport = 'cache' in new Request('https://ronin.co');

  const request = new Request('https://data.ronin.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify(requestBody),

    // Disable cache if write queries are performed, as those must be
    // guaranteed to reach RONIN.
    ...(hasWriteQuery && hasCachingSupport ? { cache: 'no-store' } : {}),

    // Allow for passing custom `fetch` options (e.g. in Next.js).
    ...(typeof options?.fetch === 'object' ? options.fetch : {}),
  });

  const fetcher = typeof options?.fetch === 'function' ? options.fetch : fetch;
  const response = await fetcher(request);

  const responseResults = await getResponseBody<QueryResponse<T>>(response);

  const startFormatting = performance.now();
  const formattedResults: ResultsPerDatabase<T> = [];

  if ('results' in responseResults) {
    const usableResults = responseResults.results as Array<Result<T>>;
    const finalResults = formatResults<T>(usableResults);

    formattedResults.push(...finalResults.map((result) => ({ result })));
  } else {
    for (const [database, { results }] of Object.entries(responseResults)) {
      const finalResults = formatResults<T>(results);
      formattedResults.push(...finalResults.map((result) => ({ result, database })));
    }
  }

  const endFormatting = performance.now();

  const VERBOSE_LOGGING =
    (typeof process !== 'undefined' &&
      process?.env &&
      process.env.__RENDER_DEBUG_LEVEL === 'verbose') ||
    (typeof import.meta?.env !== 'undefined' &&
      import.meta.env.__RENDER_DEBUG_LEVEL === 'verbose');

  if (VERBOSE_LOGGING) {
    console.log(`Formatting took ${endFormatting - startFormatting}ms`);
  }

  return formattedResults;
};

export async function runQueriesWithStorageAndTriggers<T extends ResultRecord>(
  queries: Array<Query>,
  options: QueryHandlerOptions,
): Promise<FormattedResults<T>>;

export async function runQueriesWithStorageAndTriggers<T extends ResultRecord>(
  queries: Record<string, Array<Query>>,
  options: QueryHandlerOptions,
): Promise<Record<string, FormattedResults<T>>>;

/**
 * Runs a list of `Query`s.
 *
 * @param queries - A list of RONIN queries to execute.
 * @param options - A list of options to change how the queries are executed.
 *
 * @returns The results of the queries that were passed.
 */
export async function runQueriesWithStorageAndTriggers<T extends ResultRecord>(
  queries: Array<Query> | Record<string, Array<Query>>,
  options: QueryHandlerOptions = {},
): Promise<FormattedResults<T> | Record<string, FormattedResults<T>>> {
  const singleDatabase = Array.isArray(queries);
  const normalizedQueries = singleDatabase ? { default: queries } : queries;

  const queriesWithReferences = (
    await Promise.all(
      Object.entries(normalizedQueries).map(async ([database, queries]) => {
        // Extract and process `StorableObject`s, if any are present.
        // `queriesPopulatedWithReferences` are the given `queries`, just that any
        // `StorableObject` they might contain has been processed and the value of the
        // field has been replaced with the reference to the `StoredObject`.
        // This way, we only store the `reference` of the `StoredObject` inside the
        // database for better performance.
        const populatedQueries = await processStorableObjects(queries, (objects) => {
          return uploadStorableObjects(objects, options);
        });

        return populatedQueries.map((query) => ({
          query,
          database: database === 'default' ? undefined : database,
        }));
      }),
    )
  ).flat();

  const results = await runQueriesWithTriggers<T>(queriesWithReferences, options);

  // If only a single database is being addressed, return the results of that database.
  if (singleDatabase)
    return results.filter(({ database }) => !database).map(({ result }) => result);

  // If multiple databases are being addressed, return the results of all databases.
  return results.reduce(
    (acc, { result, database = 'default' }) => {
      if (!acc[database]) acc[database] = [];
      acc[database].push(result);
      return acc;
    },
    {} as Record<string, FormattedResults<T>>,
  );
}

/**
 * Formats the result objects provided by the query compiler.
 *
 * @param result - The result to format, as received from the query compiler.
 *
 * @returns The formatted result, for use in a JavaScript environment.
 */
const formatIndividualResult = <T extends ResultRecord>(
  result: RegularResult<T>,
): RegularFormattedResult<T> => {
  // Handle `count` query result.
  if (
    'amount' in result &&
    typeof result.amount !== 'undefined' &&
    result.amount !== null
  ) {
    return Number(result.amount);
  }

  const dateFields =
    'modelFields' in result
      ? Object.entries(result.modelFields)
          .filter(([, type]) => type === 'date')
          .map(([slug]) => slug)
      : [];

  // Handle single record result.
  if ('record' in result) {
    // This happens if no matching record was found for a singular query,
    // such as `get.account.with.handle('leo')`.
    if (result.record === null) return null;

    formatDateFields(result.record, dateFields);

    return result.record;
  }

  // Handle result with multiple records.
  if ('records' in result) {
    for (const record of result.records) {
      formatDateFields(record, dateFields);
    }

    const formattedRecords = result.records as Array<T & ResultRecord> & {
      moreBefore?: string;
      moreAfter?: string;
    };

    // Expose the pagination cursors in order to allow for retrieving the
    // previous or next page.
    //
    // This value is already available on `result`, but since we're only
    // returning `result.records`, we want it to be set on that array.
    if (typeof result.moreBefore !== 'undefined')
      formattedRecords.moreBefore = result.moreBefore;
    if (typeof result.moreAfter !== 'undefined')
      formattedRecords.moreAfter = result.moreAfter;

    return formattedRecords;
  }

  return result as unknown as RegularFormattedResult<T>;
};

const formatResults = <T extends ResultRecord>(
  results: Array<Result<T>>,
): FormattedResults<T> => {
  const formattedResults: FormattedResults<T> = [];

  for (const result of results) {
    // If a `models` property is present in the result, that means the result combines
    // the results of multiple different queries.
    if ('models' in result) {
      formattedResults.push(
        Object.fromEntries(
          Object.entries(result.models).map(([model, result]) => {
            return [model, formatIndividualResult(result)];
          }),
        ) as ExpandedFormattedResult<T>,
      );

      continue;
    }

    formattedResults.push(formatIndividualResult(result));
  }

  return formattedResults;
};
