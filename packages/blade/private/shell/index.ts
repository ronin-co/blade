#!/usr/bin/env node

import { cp, readFile, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import chokidar, { type EmitArgsWithName } from 'chokidar';
import dotenv from 'dotenv';
import * as esbuild from 'esbuild';
import getPort, { portNumbers } from 'get-port';

import {
  clientInputFile,
  defaultDeploymentProvider,
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
  serverInputFolder,
} from '@/private/shell/constants';
import { type ServerState, serve } from '@/private/shell/listener';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '@/private/shell/loaders';
import {
  cleanUp,
  composeEnvironmentVariables,
  exists,
  logSpinner,
  prepareStyles,
} from '@/private/shell/utils';
import {
  getProvider,
  transformToCloudflareOutput,
  transformToNetlifyOutput,
  transformToVercelBuildOutput,
} from '@/private/shell/utils/providers';
import { generateUniqueId } from '@/private/universal/utils/crypto';
import { getOutputFile } from '@/private/universal/utils/paths';
import { createStateMessage } from '@/private/universal/utils/state-msg';
import type BuildError from '@/private/universal/utils/build-error';

// We want people to add BLADE to `package.json`, which, for example, ensures that
// everyone in a team is using the same version when working on apps.
if (!process.env['npm_lifecycle_event']) {
  console.error(
    `${loggingPrefixes.error} The package must be installed locally, not globally.`,
  );
  process.exit(0);
}

// Load the `.env` file.
dotenv.config();

const { values, positionals } = parseArgs({
  args: process.argv,
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
      default: process.env['PORT'] || '3000',
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

const isBuilding = positionals.includes('build');
const isServing = positionals.includes('serve');
const isDeveloping = !isBuilding && !isServing;
const enableServiceWorker = values.sw;

let port = Number.parseInt(values.port);

if (isDeveloping) {
  const usablePort = await getPort({ port: portNumbers(port, port + 1000) });

  if (port !== usablePort) {
    logSpinner(`Port ${port} is already in use! Using ${usablePort}`).warn();
    port = usablePort;
  }
}

const projects = [process.cwd()];
const tsConfig = path.join(process.cwd(), 'tsconfig.json');

// If a `tsconfig.json` file exists that contains a `references` field, we should include
// files from the referenced projects as well.
if (await exists(tsConfig)) {
  const tsConfigContents = JSON.parse(await readFile(tsConfig, 'utf-8'));
  const { references } = tsConfigContents || {};

  if (references && Array.isArray(references) && references.length > 0) {
    projects.push(
      ...references.map((reference) => path.join(process.cwd(), reference.path)),
    );
  }
}

const environment = isBuilding || isServing ? 'production' : 'development';
const provider = getProvider();

const server: ServerState = {};

if (isBuilding || isDeveloping) {
  await cleanUp();

  let spinner = logSpinner(
    `Building${environment === 'production' ? ' for production' : ''}`,
  );

  let bundleId: string | undefined;

  const entryPoints: esbuild.BuildOptions['entryPoints'] = [
    {
      in: clientInputFile,
      out: getOutputFile('init'),
    },
    {
      in: path.join(serverInputFolder, `${provider}.js`),
      out: defaultDeploymentProvider,
    },
  ];

  if (enableServiceWorker) {
    entryPoints.push({
      in: path.join(serverInputFolder, 'service-worker.js'),
      out: 'service-worker',
    });
  }

  const mainBuild = await esbuild.context({
    entryPoints,
    outdir: outputDirectory,
    sourcemap: 'external',
    bundle: true,
    platform: provider === 'vercel' ? 'node' : 'browser',
    format: 'esm',
    jsx: 'automatic',
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    minify: environment === 'production',
    // TODO: Remove this once `@ronin/engine` no longer relies on it.
    external: ['node:events'],
    plugins: [
      getFileListLoader(projects),
      getMdxLoader('production'),
      getReactAriaLoader(),
      getClientReferenceLoader(),
      {
        name: 'Init Loader',
        setup(build) {
          build.onStart(() => {
            bundleId = generateUniqueId();
            spinner.start();
          });

          build.onResolve({ filter: /^build-meta$/ }, (source) => ({
            path: source.path,
            namespace: 'dynamic-meta',
          }));

          build.onLoad({ filter: /^build-meta$/, namespace: 'dynamic-meta' }, () => ({
            contents: `export const bundleId = "${bundleId}";`,
            loader: 'ts',
            resolveDir: process.cwd(),
          }));

          build.onEnd(async (result) => {
            if (result.errors.length === 0) {
              const clientBundle = path.join(
                outputDirectory,
                getOutputFile('init', 'js'),
              );
              const clientSourcemap = path.join(
                outputDirectory,
                getOutputFile('init', 'js.map'),
              );

              await Promise.all([
                rename(clientBundle, clientBundle.replace('init.js', `${bundleId}.js`)),
                rename(
                  clientSourcemap,
                  clientSourcemap.replace('init.js.map', `${bundleId}.js.map`),
                ),
              ]);

              await prepareStyles(environment, projects, bundleId as string);
              spinner.succeed();

              // We're passing a query parameter in order to skip the import cache.
              const moduleName = `${defaultDeploymentProvider}.js?t=${Date.now()}`;

              // Start evaluating the server module immediately. We're not using `await`
              // to ensure that the client revalidation can begin before the module has
              // been evaluated entirely.
              server.module = import(path.join(outputDirectory, moduleName));

              // Revalidate the client.
              if (server.reloadChannel) server.reloadChannel.send('revalidate');
            } else {
              // Transform esbuild errors into a standardized format for client display
              const mappedError = result.errors.map((error) => {
                const location = {
                  file: error.location?.file,
                  text: error.location?.lineText,
                  line: error.location?.line || 0,
                  suggestion: error.location?.suggestion || '',
                };

                return {
                  location,
                  errorMessage: error.text,
                } as BuildError;
              });

              // Broadcast error state to client
              if (server.stateChannel)
                server.stateChannel.send(
                  createStateMessage('build-error', JSON.stringify(mappedError)),
                );
            }
          });
        },
      },
    ],
    banner: {
      // Prevent a crash for missing environment variables by ensuring that
      // `import.meta.env` is defined.
      js: 'if(!import.meta.env){import.meta.env={}};',
    },
    define: composeEnvironmentVariables({
      isLoggingQueries: values.queries || false,
      enableServiceWorker,
      provider,
      environment,
    }),
  });

  await mainBuild.rebuild();

  const ignored = ['node_modules', '.git', '.blade', '.husky', '.vercel'];

  const events: Record<
    Exclude<EmitArgsWithName[0], 'all' | 'raw' | 'ready' | 'error'>,
    string
  > = {
    add: 'File added',
    change: 'File changed',
    unlink: 'File removed',
    addDir: 'Directory added',
    unlinkDir: 'Directory removed',
  };

  if (isDeveloping) {
    const isWsl =
      process.platform === 'linux' && os.release().toLowerCase().includes('microsoft');

    chokidar
      .watch(process.cwd(), {
        ignored: (path) => ignored.some((item) => path.includes(item)),
        ignoreInitial: true,

        // On WSL (Linux on Windows), we need to use polling for reliable file watching.
        usePolling: isWsl,
      })
      .on('all', (event, eventPath) => {
        const eventMessage =
          event in events ? events[event as keyof typeof events] : null;
        if (!eventMessage) return;

        const relativePath = path.relative(process.cwd(), eventPath);

        spinner = logSpinner(`${eventMessage}, rebuilding: ${relativePath}`);

        mainBuild.rebuild().catch(() => {
          console.log(
            `\n${loggingPrefixes.info} ✘ Build failed! Please check the following errors\n`,
          );
          spinner.fail();
          spinner.stop();
        });
      });
  } else {
    // Stop the build context.
    await mainBuild.dispose();

    // Copy hard-coded static assets into output directory.
    if (await exists(publicDirectory)) {
      await cp(publicDirectory, outputDirectory, { recursive: true });
    }

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
  const moduleName = path.join(outputDirectory, `${defaultDeploymentProvider}.js`);

  // Initialize the edge worker. Using `await` here is essential, since we don't want the
  // first request in production to get slown down by the evaluation of the module.
  server.module = await import(moduleName);

  // Listen on a port and serve the edge worker.
  await serve(server, environment, port);
}
