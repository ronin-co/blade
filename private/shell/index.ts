#!/usr/bin/env bun
import path from 'node:path';
import { parseArgs } from 'node:util';
import { $, type Server } from 'bun';
import getPort, { portNumbers } from 'get-port';

import {
  clientOutputDirectory,
  defaultDeploymentProvider,
  frameworkDirectory,
  publicDirectory,
} from '@/private/shell/constants';
import {
  cleanUp,
  getClientEnvironmentVariables,
  logSpinner,
  prepareStyles,
  setEnvironmentVariables,
} from '@/private/shell/utils';
import * as esbuild from 'esbuild';

import { cp, exists } from 'node:fs/promises';
import {
  loggingPrefixes,
  outputDirectory,
  serverInputFolder,
} from '@/private/shell/constants';
import { serve } from '@/private/shell/listener';
import {
  getClientChunkLoader,
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '@/private/shell/loaders';
import {
  mapProviderInlineDefinitions,
  transformToCloudflareOutput,
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';
import type { Asset } from '@/private/universal/types/util';
import { generateUniqueId } from '@/private/universal/utils/crypto';
import { getOutputFile } from '@/private/universal/utils/paths';

// We want people to add BLADE to `package.json`, which, for example, ensures that
// everyone in a team is using the same version when working on apps.
if (!Bun.env['npm_lifecycle_event']) {
  console.error(
    `${loggingPrefixes.error} The package must be installed locally, not globally.`,
  );
  process.exit(0);
}

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    debug: {
      type: 'boolean',
      default: false,
    },
    queries: {
      type: 'boolean',
      default: false,
    },
    port: {
      type: 'string',
      default: Bun.env['PORT'] || '3000',
    },
    sw: {
      type: 'boolean',
      default: false,
      description: 'Enable service worker support',
    },
  },
  strict: true,
  allowPositionals: true,
});

const isInitializing = positionals.includes('init');
const isBuilding = positionals.includes('build');
const isServing = positionals.includes('serve');
const isDeveloping = !isBuilding && !isServing;
const enableServiceWorker = values.sw;

if (isInitializing) {
  const projectName = positionals[positionals.indexOf('init') + 1] ?? 'blade-example';
  const originDirectory = path.join(frameworkDirectory, 'examples', 'basic');
  const targetDirectory = path.join(process.cwd(), projectName);

  const { success, stderr } = Bun.spawnSync([
    'cp',
    '-r',
    originDirectory,
    targetDirectory,
  ]);

  try {
    await $`cd ${targetDirectory} && git init`.quiet();
  } catch (error) {
    logSpinner('Failed to initialize git repository. Is git installed?').fail();
    console.error(error);
  }

  try {
    await Bun.write(
      path.join(targetDirectory, '.gitignore'),
      `node_modules
      .env
      .blade
      `,
    );
  } catch (error) {
    logSpinner('Failed to create .gitignore').fail();
    console.error(error);
  }

  if (success) {
    logSpinner('Created example app').succeed();
  } else {
    logSpinner('Failed to create example app').fail();
    console.error(stderr);
  }

  process.exit();
}

let port = Number.parseInt(values.port);

if (isDeveloping) {
  const usablePort = await getPort({ port: portNumbers(port, port + 1000) });

  if (port !== usablePort) {
    logSpinner(`Port ${port} is already in use! Using ${usablePort}`).warn();
    port = usablePort;
  }
}

const projects = [process.cwd()];
const tsConfig = Bun.file(path.join(process.cwd(), 'tsconfig.json'));

// If a `tsconfig.json` file exists that contains a `references` field, we should include
// files from the referenced projects as well.
if (await tsConfig.exists()) {
  const tsConfigContents = await tsConfig.json();
  const { references } = tsConfigContents || {};

  if (references && Array.isArray(references) && references.length > 0) {
    projects.push(
      ...references.map((reference) => path.join(process.cwd(), reference.path)),
    );
  }
}

setEnvironmentVariables({
  isBuilding,
  isServing,
  isLoggingQueries: values.queries || false,
  enableServiceWorker,
  projects,
});

const environment = import.meta.env['BUN_ENV'] as 'production' | 'development';
const provider = import.meta.env.__BLADE_PROVIDER;

let server: Server | undefined;

if (isBuilding || isDeveloping) {
  const bundleId = generateUniqueId();

  await cleanUp();

  const clientChunks = new Map<string, string>();

  const clientEnvironmentVariables = Object.entries(getClientEnvironmentVariables()).map(
    ([key, value]) => {
      return [`import.meta.env.${key}`, JSON.stringify(value)];
    },
  );

  const projects = JSON.parse(import.meta.env['__BLADE_PROJECTS']) as string[];
  const isDefaultProvider = provider === defaultDeploymentProvider;
  const enableServiceWorker = import.meta.env.__BLADE_SERVICE_WORKER === 'true';

  const clientBuild = await esbuild.context({
    entryPoints: [path.join(serverInputFolder, `${provider}.js`)],
    entryNames: `[dir]/${path.basename(getOutputFile(bundleId))}`,
    sourcemap: 'external',
    bundle: true,
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    outdir: clientOutputDirectory,
    minify: environment === 'production',
    plugins: [
      getClientChunkLoader(clientChunks),
      getFileListLoader(),
      getMdxLoader('production'),
      getReactAriaLoader(),

      {
        name: 'end-log',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length === 0) {
              const chunkFile = Bun.file(
                path.join(outputDirectory, getOutputFile(bundleId, 'js')),
              );

              const chunkFilePrefix = [
                isDefaultProvider ? '' : 'if(!import.meta.env){import.meta.env={}};',
                `if(!window['BLADE_CHUNKS']){window['BLADE_CHUNKS']={}};`,
                `window['BLADE_BUNDLE']='${bundleId}';`,
                await chunkFile.text(),
              ].join('');

              await Bun.write(chunkFile, chunkFilePrefix);

              await prepareStyles(environment, projects, bundleId);

              // Copy hard-coded static assets into output directory.
              if (await exists(publicDirectory))
                await cp(publicDirectory, outputDirectory, { recursive: true });

              const assets = new Array<Asset>(
                { type: 'js', source: getOutputFile(bundleId, 'js') },
                { type: 'css', source: getOutputFile(bundleId, 'css') },
              );

              // In production, load the service worker script.
              if (enableServiceWorker) {
                assets.push({ type: 'worker', source: '/service-worker.js' });
              }

              import.meta.env['__BLADE_ASSETS'] = JSON.stringify(assets);
              import.meta.env['__BLADE_ASSETS_ID'] = bundleId;

              console.log('Built client');

              // Revalidate the client.
              if (server) {
                server.publish('development', 'revalidate');
              }
            }
          });
        },
      },
    ],
    // When using a serverless deployment provider, inline plain-text environment
    // variables in the client bundles.
    define: isDefaultProvider
      ? undefined
      : Object.fromEntries(clientEnvironmentVariables),
  });

  const serverBuild = await esbuild.context({
    entryPoints: [path.join(serverInputFolder, `${provider}.js`)],
    entryNames: `[dir]/${defaultDeploymentProvider}`,
    sourcemap: 'external',
    bundle: true,
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    outdir: outputDirectory,
    minify: environment === 'production',
    plugins: [
      getClientReferenceLoader(clientChunks),
      getFileListLoader(),
      getMdxLoader('production'),
      getReactAriaLoader(),

      {
        name: 'trigger-second-build',
        setup(build) {
          build.onEnd(async (result) => {
            // Only rebuild client if server build succeeded
            if (result.errors.length === 0) {
              console.log('Built server');
              await clientBuild.rebuild();
            }
          });
        },
      },
    ],

    // In production, we want to inline environment variables.
    define:
      environment === 'production' ? mapProviderInlineDefinitions(provider) : undefined,
  });

  await serverBuild.rebuild();

  if (isDeveloping) await serverBuild.watch();

  if (isBuilding) {
    switch (provider) {
      case 'cloudflare': {
        await transformToCloudflareOutput();
        break;
      }
      case 'netlify': {
        await transformToNetlifyOutput();
        break;
      }
      case 'vercel': {
        await transformToVercelBuildOutput();
        break;
      }
    }
  }
}

if (isDeveloping || isServing) {
  server = await serve(environment, port);
}
