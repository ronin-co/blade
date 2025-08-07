#!/usr/bin/env node

import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import chokidar, { type EmitArgsWithName } from 'chokidar';
import dotenv from 'dotenv';
import getPort, { portNumbers } from 'get-port';

import {
  defaultDeploymentProvider,
  loggingPrefixes,
  outputDirectory,
} from '@/private/shell/constants';
import { type ServerState, serve } from '@/private/shell/listener';
import { cleanUp, logSpinner } from '@/private/shell/utils';
import { composeBuildContext } from '@/private/shell/utils/build';

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

const environment = isBuilding || isServing ? 'production' : 'development';

const server: ServerState = {};

if (isBuilding || isDeveloping) {
  await cleanUp();

  let spinner = logSpinner(
    `Building${environment === 'production' ? ' for production' : ''}`,
  );

  const mainBuild = composeBuildContext(environment, {
    enableServiceWorker,
    logQueries: values?.queries,
    plugins: [
      {
        name: 'Spinner Loader',
        setup(build) {
          build.onStart(() => {
            spinner.start();
          });

          build.onEnd((result) => {
            if (result.errors.length === 0) {
              spinner.succeed();

              if (isDeveloping) {
                // We're passing a query parameter in order to skip the import cache.
                const moduleName = `${defaultDeploymentProvider}.js?t=${Date.now()}`;

                // Start evaluating the server module immediately. We're not using `await`
                // to ensure that the client revalidation can begin before the module has
                // been evaluated entirely.
                server.module = import(path.join(outputDirectory, moduleName));
              }
            }
          });
        },
      },
    ],
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
  }
}

// When serving the app in production, initialize the edge worker. Using `await` here is
// essential, since we don't want the first request in production to get slown down by
// the evaluation of the module.
if (isServing) {
  const moduleName = path.join(outputDirectory, `${defaultDeploymentProvider}.js`);
  server.module = await import(moduleName);
}

// Listen on a port and serve the edge worker.
if (isDeveloping || isServing) await serve(server, environment, port);
