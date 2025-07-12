import { Migration, type MigrationOptions } from '@/src/utils/migration';
import {
  type ModelWithFieldsArray,
  convertModelToObjectFields,
  getModels,
} from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { type Model, ROOT_MODEL, type Statement, Transaction } from '@ronin/compiler';
import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Database } from '@ronin/engine/resources';

const engine = new Engine({
  driver: (engine): BunDriver => new BunDriver({ engine }),
  resolvers: [(engine) => new MemoryResolver({ engine })],
});

/**
 * Queries a test database with the provided SQL statements.
 *
 * @param models - The models that should be inserted into the database.
 * @param statements - The statements that should be executed.
 * @param insertStatements - The statements that should be executed to insert records into
 * the database.
 *
 * @returns A list of rows resulting from the executed statements.
 */
export const queryEphemeralDatabase = async (
  models: Array<Model>,
  insertStatements: Array<Statement> = [],
): Promise<Database> => {
  const databaseId = Math.random().toString(36).substring(7);
  const database = await engine.createDatabase({ id: databaseId });

  await prefillDatabase(database, models, insertStatements);

  return database;
};

/**
 * Prefills the database with the provided models.
 *
 * @param databaseName - The name of the database to prefill.
 * @param models - The models that should be inserted into the database.
 * @param insertStatements - The statements that should be executed to insert records into
 * the database.
 */
export const prefillDatabase = async (
  db: Database,
  models: Array<Model>,
  insertStatements: Array<Statement> = [],
): Promise<void> => {
  const rootModelTransaction = new Transaction([{ create: { model: ROOT_MODEL } }]);

  const modelTransaction = new Transaction(
    models.map((model) => JSON.parse(JSON.stringify({ create: { model } }))),
  );

  // Create the root model and all other models.
  await db.query([...rootModelTransaction.statements, ...modelTransaction.statements]);

  // Insert records into the database.
  await db.query(insertStatements);
};

/**
 * Runs a migration by comparing defined models against existing models and applying
 * the differences.
 *
 * @param definedModels - The new/updated model definitions to migrate to.
 * @param existingModels - The current models in the database.
 * @param options - Optional configuration for migration operations.
 * @param insertStatements - The statements that should be executed to insert records into
 * the database.
 *
 * @returns Object containing:
 *   - db: The ephemeral database instance.
 *   - models: The resulting models after migration.
 *   - statements: The SQL statements that were executed.
 *   - modelDiff: The computed differences between defined and existing models.
 */
export const runMigration = async (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
  options?: MigrationOptions,
  insertStatements: Array<Statement> = [],
): Promise<{
  db: Database;
  models: Array<Model>;
  statements: Array<Statement>;
  modelDiff: Array<string>;
}> => {
  const db = await queryEphemeralDatabase(existingModels, insertStatements);

  const models = (await getModels({ db })) as Array<ModelWithFieldsArray>;
  const modelDiff = await new Migration(
    definedModels,
    models.map((model) => convertModelToObjectFields(model)),
    options,
  ).diff();
  const protocol = new Protocol(modelDiff);
  await protocol.convertToQueryObjects();

  const statements = protocol.getSQLStatements(
    models.map((model) => convertModelToObjectFields(model)),
  );

  await db.query(statements);

  return {
    db,
    models: ((await getModels({ db })) as Array<ModelWithFieldsArray>).map((model) =>
      convertModelToObjectFields(model),
    ),
    statements,
    modelDiff,
  };
};

/**
 * Retrieves the number of records in a table.
 *
 * @param db - The database instance to query.
 * @param modelSlug - The slug of the model to get the row count for.
 *
 * @returns The number of records in the table.
 */
export const getRowCount = async (db: Database, modelSlug: string): Promise<number> => {
  const res = await db.query([`SELECT COUNT(*) FROM "${modelSlug}";`]);
  return res[0].rows[0]['COUNT(*)'];
};

/**
 * Retrieves a list of all table names from a SQLite database.
 *
 * @param db - The database instance to query.
 *
 * @returns A list of table names mapped from the query results.
 */
export const getSQLTables = async (
  db: Database,
): Promise<Array<Record<string, string>>> => {
  const res = await db.query(['SELECT name FROM sqlite_master WHERE type="table";']);
  return res[0].rows;
};

/**
 * Retrieves all rows from a table.
 *
 * @param db - The database instance to query.
 * @param model - The model to get the rows for.
 *
 * @returns A list of rows from the table.
 */
export const getTableRows = async (
  db: Database,
  model: Model,
  options?: { models: Array<Model> },
): Promise<Array<Record<string, string | number>>> => {
  const transaction = new Transaction(
    [{ get: { [model?.pluralSlug || `${model.slug}s`]: null } }],
    {
      models: options?.models ?? [model],
      inlineParams: true,
    },
  );

  const result = await db.query(transaction.statements);
  return result[0].rows;
};
