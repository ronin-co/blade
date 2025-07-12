import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import ora from 'ora';

import types from '@/src/commands/types';
import { exists } from '@/src/utils/file';
import { MIGRATIONS_PATH, MODEL_IN_CODE_PATH } from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { getOrSelectSpaceId } from '@/src/utils/space';

export const exec = util.promisify(childProcess.exec);

export default async (
  positionals: Array<string>,
  token?: { appToken?: string; sessionToken?: string },
): Promise<void> => {
  const spinner = ora('Initializing project').start();
  const lastPositional = positionals.at(-1);
  let spaceHandle = lastPositional === 'init' ? null : lastPositional;

  if (!spaceHandle) {
    spaceHandle = await getOrSelectSpaceId(token?.sessionToken, spinner);
  }

  if (!(await exists('package.json'))) {
    spinner.fail(
      'No `package.json` found in the current directory. Please run the command in your project.',
    );
    process.exit(1);
  }

  try {
    // Add `.ronin` to `.gitignore` if `.gitignore` exists but doesn't contain `.ronin`.
    const gitignoreExists = await exists('.gitignore');

    if (gitignoreExists) {
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      const gitignoreContents = await fs.readFile(gitignorePath, 'utf-8');
      if (!gitignoreContents.includes('.ronin')) {
        await fs.appendFile(gitignorePath, '\n.ronin');
      }
    }

    // This case should never happen, since we log in before
    // running the init command if no tokens are provided.
    if (!(token?.appToken || token?.sessionToken)) {
      spinner.fail(
        'Run `ronin login` to authenticate with RONIN or provide an app token',
      );
      process.exit(1);
    }

    const doModelsExist =
      (
        await getModels({
          token: token.appToken || token.sessionToken,
          space: spaceHandle,
        })
      ).length > 0;

    if (doModelsExist) {
      await types(token.appToken, token.sessionToken);
    }

    // Create migration directory if it doesn't exist.
    if (!(await exists(MIGRATIONS_PATH))) {
      await fs.mkdir(MIGRATIONS_PATH, { recursive: true });
    }

    // Create a `schema/index.ts` file if it doesn't exist.
    if (!(await exists(MODEL_IN_CODE_PATH))) {
      // Ensure the parent directory exists.
      const parentDir = path.dirname(MODEL_IN_CODE_PATH);
      if (!(await exists(parentDir))) {
        await fs.mkdir(parentDir, { recursive: true });
      }
      await fs.writeFile(
        MODEL_IN_CODE_PATH,
        '// This file is the starting point to define your models in code.\n',
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('401')) {
      spinner.fail(
        `You are not a member of the "${spaceHandle}" space or the space doesn't exist.`,
      );
      process.exit(1);
    }
    throw err;
  }

  spinner.succeed('Project initialized');
};
