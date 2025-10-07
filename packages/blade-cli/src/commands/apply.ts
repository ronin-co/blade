import fs from 'node:fs';
import path from 'node:path';
import { select } from '@inquirer/prompts';
import { runQueries } from 'blade-client';
import { CompilerError } from 'blade-compiler';

import types from '@/src/commands/types';
import type { MigrationFlags } from '@/src/utils/migration';
import { MIGRATIONS_PATH } from '@/src/utils/misc';
import {
  type ModelWithFieldsArray,
  convertArrayFieldToObject,
  getModels,
} from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { spinner as ora } from '@/src/utils/spinner';

/**
 * Applies a migration file to the database.
 */
export default async (
  appToken: string | undefined,
  flags: MigrationFlags,
  migrationFilePath?: string,
): Promise<void> => {
  const spinner = ora.info('Applying migration');

  try {
    const existingModels = (await getModels({
      token: appToken,
      fieldArray: true,
    })) as Array<ModelWithFieldsArray>;

    // Verify that the migrations directory exists before proceeding.
    if (!fs.existsSync(MIGRATIONS_PATH)) {
      throw new Error(
        'Migrations directory not found. Run `blade diff` to create your first migration.',
      );
    }

    // Get all filenames of migrations in the migrations directory.
    const migrations = fs.readdirSync(MIGRATIONS_PATH);

    let migrationPrompt: string | undefined;
    if (migrations.length === 0) {
      throw new Error(
        'No migrations found. Run `blade diff` to create your first migration.',
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

    await runQueries(protocol.queries, {
      token: appToken,
      models: existingModels.map((model) => ({
        ...model,
        fields: convertArrayFieldToObject(model.fields),
      })),
    });

    spinner.succeed('Successfully applied migration');

    // If desired, generate new TypeScript types.
    if (!flags['skip-types']) await types(flags, []);

    process.exit(0);
  } catch (err) {
    const message =
      err instanceof CompilerError ? err.message : 'Failed to apply migration';
    spinner.fail(message);
    !(err instanceof CompilerError) && err instanceof Error && spinner.fail(err.message);

    process.exit(1);
  }
};
