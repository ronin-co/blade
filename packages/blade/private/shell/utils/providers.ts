import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  defaultCacheControl,
  defaultDeploymentProvider,
  outputDirectory,
} from '@/private/shell/constants';
import { exists, logSpinner } from '@/private/shell/utils';

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
  if (process.env['WORKERS_CI']) return 'cloudflare';
  if (process.env['NETLIFY']) return 'netlify';
  if (process.env['VERCEL']) return 'vercel';
  return defaultDeploymentProvider;
};

/**
 * Transform to Vercel build output API.
 *
 * @description This function is designed to run after a production build
 * has completed and transfer or transform any needed files from the `.blade/output/`
 * directory to match the necessary Vercel build output API structure.
 *
 * @see https://vercel.com/docs/build-output-api
 */
export const transformToVercelBuildOutput = async (): Promise<void> => {
  const spinner = logSpinner('Transforming output for Vercel').start();

  const vercelOutputDir = path.resolve(process.cwd(), '.vercel', 'output');
  const staticFilesDir = path.resolve(vercelOutputDir, 'static');
  const functionDir = path.resolve(vercelOutputDir, 'functions', 'worker.func');

  // Delete the directory. Checking whether it exists first is slower.
  try {
    await rm(vercelOutputDir, { recursive: true });
  } catch (err) {
    if (!((err as { code: string }).code === 'ENOENT')) throw err;
  }

  await mkdir(functionDir, { recursive: true });

  const staticDirectories = ['client', 'public'];

  await Promise.all([
    cp(outputDirectory, staticFilesDir, {
      recursive: true,
      filter: (source) => {
        if (source === outputDirectory) return true;

        // Only copy static files and exclude source maps.
        const relativeSource = path.relative(outputDirectory, source);
        const staticFile = staticDirectories.some((item) => {
          return relativeSource === item || relativeSource.startsWith(`${item}/`);
        });

        return staticFile && !source.endsWith('.map');
      },
    }),

    // Copy chunk files that are shared between client and server into worker.
    cp(path.join(outputDirectory, 'client'), path.join(functionDir, 'client'), {
      recursive: true,
      filter: (source) => {
        if (source === path.join(outputDirectory, 'client')) return true;
        return source.includes('/client/chunk.');
      },
    }),

    cp(
      path.join(outputDirectory, `${defaultDeploymentProvider}.js`),
      path.join(functionDir, 'worker.js'),
    ),

    cp(
      path.join(outputDirectory, `${defaultDeploymentProvider}.js.map`),
      path.join(functionDir, 'worker.js.map'),
    ),

    writeFile(path.join(functionDir, 'package.json'), JSON.stringify({ type: 'module' })),

    writeFile(
      path.join(vercelOutputDir, 'config.json'),
      JSON.stringify({
        version: 3,
        routes: [
          {
            src: '^/.*$',
            headers: {
              'Cache-Control': defaultCacheControl,
            },
            continue: true,
          },
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

    writeFile(
      path.join(functionDir, '.vc-config.json'),
      JSON.stringify({
        handler: 'worker.js',
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
  const spinner = logSpinner('Transforming output for Cloudflare').start();

  const promises = new Array<Promise<unknown>>(
    writeFile(
      path.join(outputDirectory, '.assetsignore'),
      ['edge-worker.js', '_routes.json', '*.map'].join('\n'),
    ),
    writeFile(
      path.join(outputDirectory, '_headers'),
      `/*\n\tCache-Control: ${defaultCacheControl}`,
    ),
  );

  // Check if a any Wrangler config exists, and if not create one.
  const jsonConfig = path.join(process.cwd(), 'wrangler.json');
  const jsoncConfig = path.join(process.cwd(), 'wrangler.jsonc');
  const tomlConfig = path.join(process.cwd(), 'wrangler.toml');
  const [jsonConfigExists, jsoncConfigExists, tomlConfigExists] = await Promise.all([
    exists(jsonConfig),
    exists(jsoncConfig),
    exists(tomlConfig),
  ]);

  if (!jsonConfigExists && !jsoncConfigExists && !tomlConfigExists) {
    spinner.info('No Wrangler config found, creating a new one...');
    const currentDirectoryName = path.basename(process.cwd());
    promises.push(
      writeFile(
        jsoncConfig,
        JSON.stringify(
          {
            $schema: 'node_modules/wrangler/config-schema.json',
            name: currentDirectoryName,
            main: '.blade/dist/edge-worker.js',
            compatibility_date: '2025-06-02',
            assets: {
              binding: 'ASSETS',
              directory: '.blade/dist/',
            },
            observability: {
              enabled: true,
              logs: {
                enabled: true,
              },
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
  const spinner = logSpinner('Transforming output for Netlify').start();

  const netlifyOutputDir = path.resolve(process.cwd(), '.netlify', 'v1');
  const edgeFunctionDir = path.resolve(netlifyOutputDir, 'edge-functions');

  const netlifyOutputDirExists = await exists(netlifyOutputDir);
  if (netlifyOutputDirExists) await rm(netlifyOutputDir, { recursive: true });

  await mkdir(edgeFunctionDir, { recursive: true });

  // Since edge functions do not offer a `preferStatic` option, we need to manually
  // provide a list of all static assets to not be routed to the edge function.
  const staticAssets = new Array<string>();
  const files = await readdir(outputDirectory, { recursive: true });

  for (const file of files) {
    if (file.startsWith('_worker') || file.endsWith('.map')) continue;
    staticAssets.push(`/${file}`);
  }

  await Promise.all([
    cp(
      path.join(outputDirectory, `${defaultDeploymentProvider}.js`),
      path.join(edgeFunctionDir, 'worker.js'),
    ),

    cp(
      path.join(outputDirectory, `${defaultDeploymentProvider}.js.map`),
      path.join(edgeFunctionDir, 'worker.js.map'),
    ),

    // Copy chunk files that are shared between client and server into worker.
    cp(path.join(outputDirectory, 'client'), path.join(edgeFunctionDir, 'client'), {
      recursive: true,
      filter: (source) => {
        if (source === path.join(outputDirectory, 'client')) return true;
        return source.includes('/client/chunk.');
      },
    }),

    writeFile(
      path.join(edgeFunctionDir, 'package.json'),
      JSON.stringify({ type: 'module' }),
    ),

    writeFile(
      path.join(edgeFunctionDir, 'index.js'),
      `export { default } from './worker.js';
export const config = {
      path: "/*",
      excludedPath: ${JSON.stringify(staticAssets)},
};`,
    ),

    writeFile(
      path.join(netlifyOutputDir, 'config.json'),
      JSON.stringify({
        headers: [
          {
            for: '/*',
            values: {
              'Cache-Control': defaultCacheControl,
            },
          },
        ],
      }),
    ),
  ]);

  spinner.succeed();
};
