#!/usr/bin/env bun

import { exec } from 'node:child_process';
import { cp, exists, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import chokidar, { type EmitArgsWithName } from 'chokidar';
import * as esbuild from 'esbuild';
import getPort, { portNumbers } from 'get-port';

import {
  clientInputFile,
  defaultDeploymentProvider,
  frameworkDirectory,
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

const execAsync = promisify(exec);

if (isInitializing) {
  const projectName = positionals[positionals.indexOf('init') + 1] ?? 'blade-example';
  const originDirectory = path.join(frameworkDirectory, '..', '..', 'examples', 'basic');
  const targetDirectory = path.join(process.cwd(), projectName);

  const { stderr } = await execAsync(`cp -r ${originDirectory} ${targetDirectory}`);

  try {
    await Bun.write(
      path.join(targetDirectory, '.gitignore'),
      'node_modules\n.env\n.blade',
    );
  } catch (error) {
    logSpinner('Failed to create .gitignore').fail();
    console.error(error);
  }

  if (stderr) {
    logSpinner('Failed to create example app').fail();
    console.error(stderr);
  } else {
    logSpinner('Created example app').succeed();
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
      getFileListLoader(),
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

          build.onResolve({ filter: /^build-meta$/ }, (source) => {
            return { path: source.path, namespace: 'dynamic-meta' };
          });

          build.onLoad({ filter: /^build-meta$/, namespace: 'dynamic-meta' }, () => {
            return {
              contents: `export const bundleId = "${bundleId}";`,
              loader: 'ts',
              resolveDir: process.cwd(),
            };
          });

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
              if (server.channel) server.channel.publish('development', 'revalidate');
            }
          });
        },
      },
    ],
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
        mainBuild.rebuild();
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
