import fs from 'node:fs/promises';
import path from 'node:path';

import { logSpinner } from '.';
import { outputDirectory } from '../constants';

/**
 * Transform to Vercel build output API.
 *
 * @description This function is designed to run after a production build
 * has completed and transfer or transform any needed files from the `.blade/`
 * directory to match the necessary Vercel build output API structure.
 *
 * @see https://vercel.com/docs/build-output-api
 */
export const transformToVercelBuildOutput = async (): Promise<void> => {
  const spinner = logSpinner('Transforming to output for Vercel (production)').start();

  const vercelOutputDir = path.resolve(process.cwd(), '.vercel', 'output');

  const vercelOutputDirExists = await fs.exists(vercelOutputDir);
  if (vercelOutputDirExists) await fs.rmdir(vercelOutputDir, { recursive: true });

  const staticDir = path.resolve(vercelOutputDir, 'static');
  const staticDirExists = await fs.exists(staticDir);
  if (!staticDirExists) await fs.mkdir(staticDir, { recursive: true });

  await fs.rename(outputDirectory, staticDir);

  const functionDir = path.resolve(vercelOutputDir, 'functions', 'index.func');
  const functionDirExists = await fs.exists(functionDir);
  if (!functionDirExists) await fs.mkdir(functionDir, { recursive: true });

  await Promise.all([
    fs.rename(path.join(staticDir, '_worker.js'), path.join(functionDir, 'index.js')),

    fs.rename(
      path.join(staticDir, '_worker.js.map'),
      path.join(functionDir, 'index.js.map'),
    ),

    Bun.write(
      path.join(vercelOutputDir, 'config.json'),
      JSON.stringify({
        version: 3,
      }),
    ),
    Bun.write(
      path.join(functionDir, '.vc-config.json'),
      JSON.stringify({
        entrypoint: 'index.js',
        runtime: 'edge',
      }),
    ),
  ]);

  spinner.succeed();
};
