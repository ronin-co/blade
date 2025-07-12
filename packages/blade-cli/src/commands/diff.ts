import fs from 'node:fs';
import path from 'node:path';
import apply from '@/src/commands/apply';
import { initializeDatabase } from '@/src/utils/database';
import { Migration, type MigrationFlags } from '@/src/utils/migration';
import { MIGRATIONS_PATH, getModelDefinitions, logTableDiff } from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { Protocol } from '@/src/utils/protocol';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { type Status, spinner } from '@/src/utils/spinner';
import { confirm } from '@inquirer/prompts';
import { CompilerError, type Model } from '@ronin/compiler';

/**
 * Creates a new migration based on model differences.
 */
export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags: MigrationFlags,
  positionals: Array<string>,
): Promise<void> => {
  if (flags['force-create'] && flags.apply) {
    throw new Error('Cannot run `--apply` and `--force-create` at the same time');
  }

  if (flags['force-drop'] && flags['force-create']) {
    throw new Error('Cannot run `--force-drop` and `--force-create` at the same time');
  }

  let status: Status = 'readingConfig';
  spinner.text = 'Reading configuration';
  const modelsInCodePath =
    positionals[positionals.indexOf('diff') + 1] &&
    path.join(process.cwd(), positionals[positionals.indexOf('diff') + 1]);

  const db = await initializeDatabase();

  try {
    const space = await getOrSelectSpaceId(sessionToken, spinner);
    status = 'comparing';
    spinner.text = 'Comparing models';

    const [existingModels, definedModels] = await Promise.all([
      flags['force-create']
        ? []
        : getModels({
            db,
            token: appToken ?? sessionToken,
            space,
            isLocal: flags.local,
          }),
      flags['force-drop'] ? [] : getModelDefinitions(modelsInCodePath),
    ]);

    if (flags.debug) {
      logModelDiffs(definedModels as Array<Model>, existingModels as Array<Model>);
    }

    spinner.stop();
    const modelDiff = await new Migration(
      definedModels as Array<Model>,
      existingModels as Array<Model>,
    ).diff();
    spinner.start();

    if (modelDiff.length === 0) {
      spinner.succeed('No changes detected');
      return process.exit(0);
    }

    // Check if the latest migration has the same diff.
    if (fs.existsSync(MIGRATIONS_PATH)) {
      const files = fs.readdirSync(MIGRATIONS_PATH);
      const migrationFiles = files.filter((f) => f.startsWith('migration-'));
      if (migrationFiles.length > 0) {
        const latestMigration = migrationFiles.sort().pop() as string;
        const latestProtocol = new Protocol();
        await latestProtocol.load(path.join(MIGRATIONS_PATH, latestMigration));
        const latestMigrationDiff = latestProtocol.queries;

        const protocol = new Protocol(modelDiff);
        await protocol.convertToQueryObjects();
        const currentMigrationDiff = protocol.queries;

        if (
          JSON.stringify(currentMigrationDiff) === JSON.stringify(latestMigrationDiff)
        ) {
          spinner.stop();
          const shouldProceed = await confirm({
            message:
              'The current changes are identical to the latest migration. Do you want to create another migration anyway?',
            default: false,
          });
          spinner.start();

          if (!shouldProceed) {
            spinner.succeed('Migration creation cancelled');
            return process.exit(0);
          }
        }
      }
    }

    status = 'syncing';
    spinner.text = 'Writing migration protocol file';

    const nextNum = (() => {
      if (!fs.existsSync(MIGRATIONS_PATH)) return 1;
      const files = fs.readdirSync(MIGRATIONS_PATH);
      const migrationFiles = files.filter((f) => f.startsWith('migration-'));
      if (migrationFiles.length === 0) return 1;
      const numbers = migrationFiles.map((f) => Number.parseInt(f.split('-')[1]));
      return Math.max(...numbers) + 1;
    })();

    const paddedNum = String(nextNum).padStart(4, '0');
    const protocol = new Protocol(modelDiff);
    await protocol.convertToQueryObjects();
    protocol.save(`migration-${paddedNum}`);

    if (flags.sql) {
      const allModels = [...existingModels, ...definedModels];
      await protocol.saveSQL(`migration-${paddedNum}`, allModels as Array<Model>);
    }

    spinner.succeed('Successfully generated migration protocol file');

    // If desired, immediately apply the migration
    if (flags.apply) {
      await apply(appToken, sessionToken, flags);
    }

    process.exit(0);
  } catch (err) {
    const message =
      err instanceof CompilerError
        ? err.message
        : `Failed during ${status}: ${err instanceof Error ? err.message : err}`;
    spinner.fail(message);

    process.exit(1);
  }
};

/**
 * Helper to log model differences in debug mode.
 */
const logModelDiffs = (
  definedModels: Array<Model>,
  existingModels: Array<Model>,
): void => {
  for (const existingModel of existingModels) {
    const definedModel = definedModels.find((local) => local.slug === existingModel.slug);
    if (definedModel && definedModel !== existingModel) {
      logTableDiff(definedModel, existingModel, definedModel.slug);
    }
  }
};
