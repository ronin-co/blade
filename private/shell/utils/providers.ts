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
  const staticFilesDir = path.resolve(vercelOutputDir, 'static');
  const functionDir = path.resolve(vercelOutputDir, 'functions', 'index.func');

  const vercelOutputDirExists = await fs.exists(vercelOutputDir);
  if (vercelOutputDirExists) await fs.rmdir(vercelOutputDir, { recursive: true });

  await Promise.all([
    fs.mkdir(staticFilesDir, { recursive: true }),
    fs.mkdir(functionDir, { recursive: true }),
  ]);

  await fs.rename(outputDirectory, staticFilesDir);

  await Promise.all([
    Bun.write(
      path.join(functionDir, 'index.js'),
      `import worker from './_worker.js';
export default function (request, event) {
  return worker.fetch(request, {}, event);
}`,
    ),

    fs.rename(
      path.join(staticFilesDir, '_worker.js'),
      path.join(functionDir, '_worker.js'),
    ),

    fs.rename(
      path.join(staticFilesDir, '_worker.js.map'),
      path.join(functionDir, '_worker.js.map'),
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
