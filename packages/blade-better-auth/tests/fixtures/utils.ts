import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { ROOT_MODEL, Transaction } from 'blade-compiler';
import type { Model, Query, ResultRecord } from 'blade-compiler';
import { type Database, Hive } from 'hive';
import { BunDriver } from 'hive/bun-driver';
import { MemoryStorage } from 'hive/memory-storage';
import { createSyntaxFactory } from 'ronin';

import { Account, Session, User, Verification } from '@/fixtures/schema';
import { ronin } from '@/index';

const hive = new Hive({
  storage: ({ events }) =>
    new MemoryStorage({
      events,
      driver: new BunDriver(),
    }),
});

export const DEFAULT_MODELS = [
  User,

  Account,
  Session,
  Verification,
] as unknown as Array<Model>;

export const TEST_USER = {
  email: 'test-email@email.com',
  name: 'Test Name',
  password: 'password',
};

type SyntaxFactory = ReturnType<typeof createSyntaxFactory>;

export const cleanup = async (): Promise<void> => {
  // Delete all databases in the engine.
  const databases = (await hive.list()).filter(
    (item) => item.type === 'database',
  ) as Array<Database>;
  await Promise.all(databases.map(({ id }) => hive.delete({ type: 'database', id })));
};

/**
 * Create a new instance of test tools.
 *
 * This includes an ephemeral database instance, a RONIN client instance, and a
 * Better Auth instance.
 *
 * @param [options] - The options for the test tools
 * @param [options.betterAuth] - The options for the Better Auth instance
 * @param [options.models] - The models to create in the database
 *
 * @returns An object containing the Better Auth instance and the RONIN client
 */
export const init = async (options?: {
  betterAuth?: BetterAuthOptions;
  models?: Array<Model>;
}): Promise<{
  auth: ReturnType<typeof betterAuth>;
  client: SyntaxFactory;
  database: Database;
}> => {
  const { betterAuth: betterAuthOptions, models = DEFAULT_MODELS } = options ?? {};

  // Create an ephemeral database instance.
  // @ts-expect-error For some reason `crypto.randomUUID` is not getting picked up
  const databaseId = crypto.randomUUID();
  const database = await hive.create({ type: 'database', id: databaseId });

  // Create the root model & all other models.
  const queries = new Array<Query>({ create: { model: ROOT_MODEL } });
  for (const model of models) queries.push({ create: { model } });
  const transaction = new Transaction(queries);

  const hiveStatements = transaction.statements.map(({ statement, params }) => {
    return {
      sql: statement,
      params: params as Array<string>,
    };
  });

  await database.query(hiveStatements);

  // Create a new RONIN client instance to communicate with the in-memory database.
  const client = createSyntaxFactory({
    // @ts-expect-error Ignore missing `preconnect` property error.
    fetch: async (request: Request): Promise<Response> => {
      const { queries } = (await request.json()) as { queries: Array<object> };
      const transaction = new Transaction(queries, { models });

      const hiveStatements = transaction.statements.map(({ statement, params }) => {
        return {
          sql: statement,
          params: params as Array<string>,
        };
      });

      const results = await database.query<Array<ResultRecord>>(hiveStatements);
      const formattedResults = transaction.formatResults(results.map(({ rows }) => rows));
      return Response.json({
        results: formattedResults,
      });
    },
    token: Math.random().toString(36).substring(7),
  });

  // Every test gets its own Better Auth instance connected to the mock database.
  const auth = betterAuth(
    Object.assign(
      {
        database: ronin(client),
        emailAndPassword: {
          enabled: true,
        },
        plugins: [bearer()],
      },
      betterAuthOptions,
    ),
  );

  return {
    auth,
    client,
    database,
  };
};
