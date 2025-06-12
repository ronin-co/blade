#!/usr/bin/env bun
import path from 'node:path';
import { parseArgs } from 'node:util';
import { $ } from 'bun';
import getPort, { portNumbers } from 'get-port';

import { defaultDeploymentProvider, frameworkDirectory } from '@/private/shell/constants';
import { cleanUp, logSpinner, setEnvironmentVariables } from '@/private/shell/utils';
import * as esbuild from 'esbuild';

import {
  loggingPrefixes,
  outputDirectory,
  serverInputFolder,
} from '@/private/shell/constants';
import {
  getClientChunkLoader,
  getClientReferenceLoader,
  getFileListLoader,
} from '@/private/shell/loaders';

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
  port,
  projects,
});

if (isBuilding || isDeveloping) {
  const provider = import.meta.env.__BLADE_PROVIDER;

  await cleanUp();

  const clientChunks = new Map<string, string>();

  const clientBuild = await esbuild.context({
    entryPoints: [path.join(serverInputFolder, `${provider}.js`)],
    entryNames: '[dir]/client.js',
    sourcemap: 'external',
    bundle: true,
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    outdir: outputDirectory,
    plugins: [
      getClientChunkLoader(clientChunks),
      getFileListLoader(),

      {
        name: 'end-log',
        setup(build) {
          build.onEnd((result) => {
            // Only rebuild client if server build succeeded
            if (result.errors.length === 0) {
              console.log('Built client');
            }
          });
        },
      },
    ],
  });

  const serverBuild = await esbuild.context({
    entryPoints: [path.join(serverInputFolder, `${provider}.js`)],
    entryNames: `[dir]/${defaultDeploymentProvider}`,
    sourcemap: 'external',
    bundle: true,
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    outdir: outputDirectory,
    plugins: [
      getClientReferenceLoader(clientChunks),
      getFileListLoader(),

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
  });

  await serverBuild.rebuild();
  await serverBuild.watch();
}
