#!/usr/bin/env node

import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import cmdApply from 'blade-cli/commands/apply';
import cmdDiff from 'blade-cli/commands/diff';
import cmdLogin from 'blade-cli/commands/login';
import cmdTypes from 'blade-cli/commands/types';
import { getSession } from 'blade-cli/utils';
import chokidar, { type EmitArgsWithName } from 'chokidar';
import dotenv from 'dotenv';
import getPort, { portNumbers } from 'get-port';

import { defaultDeploymentProvider, outputDirectory } from '@/private/shell/constants';
import { type ServerState, serve } from '@/private/shell/listener';
import { cleanUp, logSpinner } from '@/private/shell/utils';
import { composeBuildContext } from '@/private/shell/utils/build';

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
    'asset-prefix': {
      type: 'string',
      description: 'Used to prefix all static asset URLs',
    },
  },
  strict: true,
  allowPositionals: true,
});

// This ensures that people can accidentally type uppercase letters and still get the
// command they are looking for.
const normalizedPositionals = positionals.map((positional) => positional.toLowerCase());

// If this environment variable is provided, the CLI will authenticate as an app for a
// particular space instead of authenticating as an account. This is especially useful
// in CI, which must be independent of individual people.
const appToken = process.env['RONIN_TOKEN'];

// This determines whether the new database engine should be used.
const enableHive = process.env['BLADE_DATA_WORKER'] === 'db.ronin.co';

// If there is no active session, automatically start one and then continue with the
// execution of the requested sub command, if there is one. If the `login` sub command
// is invoked, we don't need to auto-login, since the command itself will handle it.
const session = await getSession();

// `blade login` command
const isLoggingIn = normalizedPositionals.includes('login');
if (isLoggingIn) await cmdLogin(appToken, true);

// `blade diff` command.
const isDiffing = normalizedPositionals.includes('diff');
if (isDiffing)
  await cmdDiff(
    appToken,
    session?.token,
    {
      debug: values.debug,
      help: false,
      version: false,
    },
    positionals,
    enableHive,
  );

// `blade apply` command.
const isApplying = normalizedPositionals.includes('apply');
if (isApplying)
  await cmdApply(
    appToken,
    session?.token,
    {
      debug: values.debug,
      help: false,
      version: false,
    },
    enableHive,
  );

// `blade types` command.
const isGeneratingTypes = normalizedPositionals.includes('types');
if (isGeneratingTypes) {
  await cmdTypes(appToken, session?.token, {
    debug: values.debug,
    help: false,
    version: false,
  });
  process.exit(0);
}

const isBuilding = normalizedPositionals.includes('build');
const isServing = normalizedPositionals.includes('serve');
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

  const mainBuild = await composeBuildContext(environment, {
    enableServiceWorker,
    logQueries: values?.queries,
    assetPrefix: values?.['asset-prefix'],
    plugins: [
      {
        name: 'Spinner Loader',
        buildStart() {
          spinner.start();
        },
        writeBundle() {
          spinner.succeed();

          if (isDeveloping) {
            const moduleName = `${defaultDeploymentProvider}.js?t=${Date.now()}`;
            server.module = import(path.join(outputDirectory, moduleName));
          }
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
