import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { createSyntaxFactory } from 'ronin';
import { ROOT_MODEL, Transaction } from 'blade-compiler';

import { Account, Session, User, Verification } from '@/fixtures/schema';
import { ronin } from '@/index';

import type { Database } from '@ronin/engine/resources';
import type { BetterAuthOptions } from 'better-auth';
import type { Model, Query, ResultRecord } from 'blade-compiler';

const engine = new Engine({
  driver: (engine): BunDriver => new BunDriver({ engine }),
  resolvers: [(engine) => new MemoryResolver({ engine })],
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
  const databases = await engine.listDatabases();
  await Promise.all(databases.map(({ id }) => engine.deleteDatabase({ id })));
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
  const database = await engine.createDatabase({ id: databaseId });

  // Create the root model & all other models.
  const queries = new Array<Query>({ create: { model: ROOT_MODEL } });
  for (const model of models) queries.push({ create: { model } });
  const transaction = new Transaction(queries);
  await database.query(transaction.statements);

  // Create a new RONIN client instance to communicate with the in-memory database.
  const client = createSyntaxFactory({
    // @ts-expect-error Ignore missing `preconnect` property error.
    fetch: async (request: Request): Promise<Response> => {
      const { queries } = (await request.json()) as { queries: Array<object> };
      const transaction = new Transaction(queries, { models });
      const results = await database.query<Array<ResultRecord>>(transaction.statements);
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
