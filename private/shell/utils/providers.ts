import fs from 'node:fs/promises';
import path from 'node:path';

import { outputDirectory } from '@/private/shell/constants';
import { logSpinner } from '@/private/shell/utils';

import type {
  VercelConfig,
  VercelNodejsServerlessFunctionConfig,
} from '@/private/shell/types';

/**
 * Get the name of the provider based on the environment variables.
 *
 * @returns A string representing the provider name.
 */
export const getProvider = (): typeof Bun.env.__BLADE_PROVIDER => {
  if (Bun.env['CF_PAGES'] || Bun.env['WORKERS_CI']) return 'cloudflare';
  if (Bun.env['NETLIFY']) return 'netlify';
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
    case 'netlify':
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
  const functionDir = path.resolve(vercelOutputDir, 'functions', '_worker.func');

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
      path.join(functionDir, '_worker.mjs'),
    ),

    fs.rename(
      path.join(staticFilesDir, '_worker.js.map'),
      path.join(functionDir, '_worker.mjs.map'),
    ),

    Bun.write(
      path.join(vercelOutputDir, 'config.json'),
      JSON.stringify({
        version: 3,
        routes: [
          {
            handle: 'filesystem',
          },
          {
            src: '^(?:/(.*?))?/?$',
            dest: '_worker',
          },
        ],
      } satisfies VercelConfig),
    ),
    Bun.write(
      path.join(functionDir, '.vc-config.json'),
      JSON.stringify({
        handler: '_worker.mjs',
        launcherType: 'Nodejs',
        runtime: 'nodejs22.x',
      } satisfies VercelNodejsServerlessFunctionConfig),
    ),
  ]);

  spinner.succeed();
};

/**
 * Transform to match the Cloudflare output structure.
 */
export const transformToCloudflareOutput = async (): Promise<void> => {
  const spinner = logSpinner(
    'Transforming to output for Cloudflare (production)',
  ).start();

  const promises = new Array<Promise<unknown>>(
    Bun.write(
      path.join(outputDirectory, '.assetsignore'),
      ['_worker.js', '_worker.js.map', '_routes.json'].join('\n'),
    ),
  );

  // Check if a any Wrangler config exists, and if not create one.
  const jsonConfig = path.join(process.cwd(), 'wrangler.json');
  const jsoncConfig = path.join(process.cwd(), 'wrangler.jsonc');
  const tomlConfig = path.join(process.cwd(), 'wrangler.toml');
  const [jsonConfigExists, jsoncConfigExists, tomlConfigExists] = await Promise.all([
    fs.exists(jsonConfig),
    fs.exists(jsoncConfig),
    fs.exists(tomlConfig),
  ]);

  if (!jsonConfigExists && !jsoncConfigExists && !tomlConfigExists) {
    spinner.info('No Wrangler config found, creating a new one...');
    const currentDirectoryName = path.basename(process.cwd());
    promises.push(
      Bun.write(
        jsoncConfig,
        JSON.stringify(
          {
            $schema: 'node_modules/wrangler/config-schema.json',
            name: currentDirectoryName,
            main: '.blade/_worker.js',
            compatibility_date: '2025-06-02',
            compatibility_flags: ['nodejs_als', 'nodejs_compat'],
            assets: {
              binding: 'ASSETS',
              directory: '.blade/',
            },
          },
          null,
          4,
        ),
      ),
    );
  }

  await Promise.all(promises);

  spinner.succeed();
};

/**
 * Transform to match the Netlify output structure.
 */
export const transformToNetlifyOutput = async (): Promise<void> => {
  const spinner = logSpinner('Transforming to output for Netlify (production)').start();

  const netlifyOutputDir = path.resolve(process.cwd(), '.netlify', 'v1');
  const functionDir = path.resolve(netlifyOutputDir, 'edge-functions');

  // Create the `.netlify/v1/edge-functions/` directory if it does not exist.
  const netlifyOutputDirExists = await fs.exists(netlifyOutputDir);
  if (netlifyOutputDirExists) await fs.rmdir(netlifyOutputDir, { recursive: true });

  await Promise.all([
    fs.rename(
      path.join(outputDirectory, '_worker.js'),
      path.join(functionDir, '_worker.js'),
    ),
    fs.rename(
      path.join(outputDirectory, '_worker.js.map'),
      path.join(functionDir, '_worker.js.map'),
    ),
    Bun.write(
      path.join(netlifyOutputDir, 'config.json'),
      JSON.stringify({
        edge_functions: [
          {
            function: '_worker',
            path: '/*',
          },
        ],
      }),
    ),
  ]);

  spinner.succeed();
};
