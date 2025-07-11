import fixtureData from '@/fixtures/data.json';
import { type Model, type Query, ROOT_MODEL, Transaction } from '@/src/index';
import { convertToSnakeCase, getProperty, setProperty } from '@/src/utils/helpers';
import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Database, Row, Statement } from '@ronin/engine/resources';

/** A regex for asserting RONIN record IDs. */
export const RECORD_ID_REGEX = /[a-z]{3}_[a-z0-9]{16}/;

/** A regex for asserting RONIN record timestamps. */
export const RECORD_TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;

/** A regex for asserting RONIN pagination cursors. */
export const PAGINATION_CURSOR_REGEX = /^(?:[a-zA-Z0-9_]+,)*[a-zA-Z0-9_]*\d{13}$/;

/**
 * Pre-fills the database with the provided models and their respective data.
 *
 * @param databaseName - The name of the database that should be pre-filled.
 * @param models - The models that should be inserted.
 *
 * @returns A promise that resolves when the database has been pre-filled.
 */
const prefillDatabase = async (
  database: Database,
  models: Array<Model>,
): Promise<void> => {
  const rootModelTransaction = new Transaction([{ create: { model: ROOT_MODEL } }]);

  const modelTransaction = new Transaction(
    models.map((model) => ({ create: { model } })),
  );

  const createdModels = modelTransaction.models;

  const dataQueries: Array<Query> = createdModels.flatMap(
    (createdModel): Array<Query> => {
      const fixtureSlug = convertToSnakeCase(
        createdModel.slug.replace('roninLink', ''),
      ) as keyof typeof fixtureData;
      const data = fixtureData[fixtureSlug] || [];

      const formattedData = data.map((row) => {
        const newRow: Record<string, unknown> = {};

        for (const fieldSlug of Object.keys(createdModel.fields)) {
          const match = getProperty(row, fieldSlug);
          if (typeof match === 'undefined') continue;
          setProperty(newRow, fieldSlug, match);
        }

        return newRow;
      });

      return formattedData.map((row): Query => {
        return { add: { [createdModel.slug]: { with: row } } };
      });
    },
  );

  const dataTransaction = new Transaction(dataQueries, { models: createdModels });

  const statements = [
    ...rootModelTransaction.statements,
    ...modelTransaction.statements,
    ...dataTransaction.statements,
  ];

  await database.query(statements);
};

const ENGINE = new Engine({
  driver: (engine): BunDriver => new BunDriver({ engine }),
  resolvers: [(engine) => new MemoryResolver({ engine })],
});

/**
 * Queries an ephemeral test database with the provided SQL statements.
 *
 * @param models - The models that should be inserted into the database.
 * @param statements - The statements that should be executed.
 *
 * @returns A list of rows resulting from the executed statements.
 */
export const queryEphemeralDatabase = async (
  models: Array<Model>,
  statements: Array<Statement>,
): Promise<Array<Array<Row>>> => {
  const databaseId = Math.random().toString(36).substring(7);
  const database = await ENGINE.createDatabase({ id: databaseId });

  await prefillDatabase(database, models);

  const results = await database.query(statements);
  const formattedResults = results.map((result) => result.rows);

  await ENGINE.deleteDatabase({ id: databaseId });

  return formattedResults;
};
