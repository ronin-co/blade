import fs from 'node:fs/promises';
import path from 'node:path';

import { outputDirectory } from '@/private/shell/constants';
import { logSpinner } from '@/private/shell/utils';

/**
 * Get the name of the provider based on the environment variables.
 *
 * @returns A string representing the provider name.
 */
export const getProvider = (): typeof Bun.env.__BLADE_PROVIDER => {
  if (Bun.env['CF_PAGES']) return 'cloudflare';
  if (Bun.env['VERCEL']) return 'vercel';
  return '';
};

/**
 * Remap inline environment variable definitions.
 *
 * @description This is primarily used to inline all environment variables on
 * Cloudflare Pages or Vercel, because their runtime does not have support for
 * `import.meta.env`. Everywhere else, only inline what is truly necessary
 * (what cannot be made available at runtime).
 *
 * @returns A record / object of environment variables to be inlined.
 */
export const mapProviderInlineDefinitions = (): Record<string, string> => {
  switch (import.meta.env.__BLADE_PROVIDER) {
    case 'cloudflare':
    case 'vercel': {
      return Object.fromEntries(
        Object.entries(import.meta.env)
          .filter(([key]) => key.startsWith('BLADE_') || key.startsWith('__BLADE_'))
          .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
      );
    }
    default:
      return {
        'import.meta.env.__BLADE_ASSETS': JSON.stringify(import.meta.env.__BLADE_ASSETS),
        'import.meta.env.__BLADE_ASSETS_ID': JSON.stringify(
          import.meta.env.__BLADE_ASSETS_ID,
        ),
      };
  }
};

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
    fs.rename(
      path.join(staticFilesDir, '_worker.js'),
      path.join(functionDir, 'index.mjs'),
    ),

    fs.rename(
      path.join(staticFilesDir, '_worker.js.map'),
      path.join(functionDir, 'index.mjs.map'),
    ),

    Bun.write(
      path.join(vercelOutputDir, 'config.json'),
      JSON.stringify({
        version: 3,
        routes: [
          {
            src: '/(.*)',
            dest: '/index',
          },
        ],
      }),
    ),
    Bun.write(
      path.join(functionDir, '.vc-config.json'),
      JSON.stringify({
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        runtime: 'nodejs22.x',
      }),
    ),
  ]);

  spinner.succeed();
};
