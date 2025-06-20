import fs from 'node:fs/promises';
import path from 'node:path';

import { defaultDeploymentProvider, outputDirectory } from '@/private/shell/constants';
import { logSpinner } from '@/private/shell/utils';

import type {
  VercelConfig,
  VercelNodejsServerlessFunctionConfig,
} from '@/private/shell/types';
import type { DeploymentProvider } from '@/private/universal/types/util';

/**
 * Get the name of the provider based on the environment variables.
 *
 * @returns A string representing the provider name.
 */
export const getProvider = (): DeploymentProvider => {
  if (Bun.env['WORKERS_CI']) return 'cloudflare';
  if (Bun.env['NETLIFY']) return 'netlify';
  if (Bun.env['VERCEL']) return 'vercel';
  return defaultDeploymentProvider;
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
  const functionDir = path.resolve(vercelOutputDir, 'functions', 'worker.func');

  const vercelOutputDirExists = await fs.exists(vercelOutputDir);
  if (vercelOutputDirExists) await fs.rmdir(vercelOutputDir, { recursive: true });

  await Promise.all([
    fs.mkdir(staticFilesDir, { recursive: true }),
    fs.mkdir(functionDir, { recursive: true }),
  ]);

  await fs.rename(outputDirectory, staticFilesDir);

  await Promise.all([
    fs.rename(
      path.join(staticFilesDir, `${defaultDeploymentProvider}.js`),
      path.join(functionDir, 'worker.mjs'),
    ),

    fs.rename(
      path.join(staticFilesDir, `${defaultDeploymentProvider}.js.map`),
      path.join(functionDir, 'worker.mjs.map'),
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
            dest: 'worker',
          },
        ],
      } satisfies VercelConfig),
    ),
    Bun.write(
      path.join(functionDir, '.vc-config.json'),
      JSON.stringify({
        handler: 'worker.mjs',
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
      ['edge-worker.js', 'edge-worker.js.map', '_routes.json'].join('\n'),
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
            main: '.blade/edge-worker.js',
            compatibility_date: '2025-06-02',
            compatibility_flags: ['nodejs_compat'],
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
  const edgeFunctionDir = path.resolve(netlifyOutputDir, 'edge-functions');

  const netlifyOutputDirExists = await fs.exists(netlifyOutputDir);
  if (netlifyOutputDirExists) await fs.rmdir(netlifyOutputDir, { recursive: true });

  await fs.mkdir(edgeFunctionDir, { recursive: true });

  // Since edge functions do not offer a `preferStatic` option, we need to manually
  // provide a list of all static assets to not be routed to the edge function.
  const staticAssets = new Array<string>();
  const glob = new Bun.Glob('./**/*');
  for await (const file of glob.scan(outputDirectory)) {
    if (file.startsWith('/_worker') || file.endsWith('.map')) continue;
    staticAssets.push(file.replaceAll('./', '/'));
  }

  await Promise.all([
    fs.rename(
      path.join(outputDirectory, `${defaultDeploymentProvider}.js`),
      path.join(edgeFunctionDir, 'worker.mjs'),
    ),
    fs.rename(
      path.join(outputDirectory, `${defaultDeploymentProvider}.js.map`),
      path.join(edgeFunctionDir, 'worker.mjs.map'),
    ),
    Bun.write(
      path.join(edgeFunctionDir, 'index.mjs'),
      `export { default } from './worker.mjs';
export const config = {
      path: "/*",
      excludedPath: ${JSON.stringify(staticAssets)},
};`,
    ),
  ]);

  spinner.succeed();
};
