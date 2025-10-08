import {
  type Query,
  type RegularResult,
  type Result,
  type ResultRecord,
  type Statement,
  Transaction,
} from 'blade-compiler';
import { Hive, Selector } from 'hive';
import { RemoteStorage } from 'hive/remote-storage';
import type { RowValues } from 'hive/sdk/transaction';

import { processStorableObjects, uploadStorableObjects } from '@/src/storage';
import { runQueriesWithTriggers } from '@/src/triggers';
import type {
  ExpandedFormattedResult,
  FormattedResults,
  QueryHandlerOptions,
  RegularFormattedResult,
} from '@/src/types/utils';
import { formatDateFields, validateDefaults } from '@/src/utils/helpers';

export interface QueryPerDatabase {
  query: Query;
  database?: string;
}

interface StatementPerDatabase {
  statement: Statement;
  database?: string;
}

export interface ResultPerDatabase<T> {
  result: FormattedResults<T>[number];
  database?: string;
}

const clients: Record<string, Hive> = {};

const defaultDatabaseCaller: QueryHandlerOptions['databaseCaller'] = async (
  statements,
  options,
) => {
  const { token, database, stream } = options;
  const key = `${token || 'local'}${stream ? `-${stream}` : ''}`;

  if (!clients[key]) {
    // If a token is available, initiate a connection to the remote storage.
    if (token) {
      const prefix = stream ? 'db-leader' : 'db';

      clients[key] = new Hive({
        storage: new RemoteStorage({ remote: `https://${prefix}.ronin.co/api`, token }),
      });
    }
    // If no token is available, we must try to initialize disk storage.
    else {
      if (typeof Bun === 'undefined') {
        let message = 'You must either provide `RONIN_TOKEN` and `RONIN_ID` as';
        message += ' environment variables, or run Blade with Bun, such that it can';
        message += ' create a local database for you. To use Bun, prefix every command';
        message += ' with `bun --bun`, like this: `bun --bun blade`.';

        throw new Error(message);
      }

      const { BunDriver } = await import('hive/bun-driver');
      const { DiskStorage } = await import('hive/disk-storage');

      // We purposefully don't use extra native modules here, to avoid having to declare
      // them as external.
      const dir = [process.cwd(), '.blade', 'state'].join('/');

      clients[key] = new Hive({
        driver: new BunDriver(),
        storage: new DiskStorage({ dir }),
      });
    }
  }

  const hive = clients[key];
  const db = new Selector<'database'>(database);

  // If no token for accessing a remote storage is available, we should auto-create a
  // local database.
  if (!token && !(await hive.has(db))) {
    console.log(`Created new database ${db}`);
    await hive.create(db);
  }

  const results = await hive.storage.query(db, {
    statements: statements.map((item) => ({ ...item, method: 'values' })),
    mode: 'DEFERRED',
  });

  return {
    results: results.map((result) => result.rows as Array<RowValues>),
    raw: true,
  };
};

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
  queries: Array<QueryPerDatabase> | Array<StatementPerDatabase>,
  options: QueryHandlerOptions = {},
): Promise<Array<ResultPerDatabase<T>>> => {
  // Ensure that essential options are present. We must only perform this check if there
  // is a guarantee that actual queries must be executed. For example, if the client is
  // initialized with triggers that run all the queries using a different data source, we
  // don't want to require these options.
  validateDefaults(options);

  const rawQueries = queries.filter((item) => 'query' in item).map((item) => item.query);

  const database = queries[0].database || options.database || 'db:main';

  const transaction = new Transaction(rawQueries, {
    models: options.models,
    defaultRecordLimit: options.defaultRecordLimit,

    // Hive doesn't support non-deterministic default values at the moment.
    inlineDefaults: true,
  });

  const callDatabase = options.databaseCaller || defaultDatabaseCaller;

  const formattedResults = await transaction.formatResults((statements) => {
    return callDatabase(statements, {
      token: options.token,
      database,
      stream: options.stream,
    });
  });

  const startFormatting = performance.now();

  // The `transaction.formatResults` logic of the query compiler (which is invoked
  // above), purposefully only formats results in a network-serializable manner. The
  // formatting logic below applies formatting that is specific to the JavaScript
  // environment, such as using `Date` instances for timestamps.
  const finalResults = formatResults<T>(formattedResults as Array<Result<T>>);

  const endFormatting = performance.now();

  if (options.debug) {
    console.log(`Client formatting took ${endFormatting - startFormatting}ms`);
  }

  return finalResults.map((result) => ({ result }));
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
