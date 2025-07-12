import fs from 'node:fs';
import path from 'node:path';
import { select } from '@inquirer/prompts';
import type { Database } from '@ronin/engine/resources';
import { CompilerError } from 'blade-compiler';

import types from '@/src/commands/types';
import { initializeDatabase } from '@/src/utils/database';
import type { MigrationFlags } from '@/src/utils/migration';
import { MIGRATIONS_PATH } from '@/src/utils/misc';
import {
  type ModelWithFieldsArray,
  convertArrayFieldToObject,
  getModels,
} from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { spinner as ora } from '@/src/utils/spinner';

/**
 * Applies a migration file to the database.
 */
export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: MigrationFlags,
  migrationFilePath?: string,
): Promise<void> => {
  const spinner = ora.info('Applying migration');

  const db = await initializeDatabase();

  try {
    const space = await getOrSelectSpaceId(sessionToken, spinner);

    const existingModels = (await getModels({
      db,
      token: appToken ?? sessionToken,
      space,
      isLocal: flags.local,
      fieldArray: true,
    })) as Array<ModelWithFieldsArray>;

    // Verify that the migrations directory exists before proceeding.
    if (!fs.existsSync(MIGRATIONS_PATH)) {
      throw new Error(
        'Migrations directory not found. Run `ronin diff` to create your first migration.',
      );
    }

    // Get all filenames of migrations in the migrations directory.
    const migrations = fs.readdirSync(MIGRATIONS_PATH);

    let migrationPrompt: string | undefined;
    if (migrations.length === 0) {
      throw new Error(
        'No migrations found. Run `ronin diff` to create your first migration.',
      );
    }

    if (!flags.apply) {
      migrationPrompt =
        migrationFilePath ??
        (await select({
          message: 'Which migration do you want to apply?',
          choices: migrations
            // Sort in reverse lexical order.
            .sort((a, b) => b.localeCompare(a))
            .map((migration) => ({
              name: migration,
              value: path.join(MIGRATIONS_PATH, migration),
            })),
        }));
    }

    const protocol = await new Protocol().load(migrationPrompt);
    const statements = protocol.getSQLStatements(
      existingModels.map((model) => ({
        ...model,
        fields: convertArrayFieldToObject(model.fields),
      })),
    );

    await applyMigrationStatements(
      appToken ?? sessionToken,
      flags,
      db,
      statements,
      space,
    );

    spinner.succeed('Successfully applied migration');

    // If desired, generate new TypeScript types.
    if (!flags['skip-types']) await types(appToken, sessionToken);

    process.exit(0);
  } catch (err) {
    const message =
      err instanceof CompilerError ? err.message : 'Failed to apply migration';
    spinner.fail(message);
    !(err instanceof CompilerError) && err instanceof Error && spinner.fail(err.message);

    process.exit(1);
  }
};

/**
 * Applies migration statements to the database.
 */
export const applyMigrationStatements = async (
  appTokenOrSessionToken: string | undefined,
  flags: MigrationFlags,
  db: Database,
  statements: Array<{ statement: string }>,
  slug: string,
): Promise<void> => {
  if (flags.local) {
    ora.info('Applying migration to local database');

    await db.query(statements.map(({ statement }) => statement));
    fs.writeFileSync('.ronin/db.sqlite', await db.getContents());

    return;
  }

  ora.info('Applying migration to production database');

  const response = await fetch(`https://data.ronin.co/?data-selector=${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appTokenOrSessionToken}`,
    },
    body: JSON.stringify({
      nativeQueries: statements.map((query) => ({
        query: query.statement,
        mode: 'write',
      })),
    }),
  });

  const result = (await response.json()) as { error: { message: string } };

  if (!response.ok) {
    throw new Error(result.error.message);
  }
};
