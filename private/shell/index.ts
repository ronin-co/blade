#!/usr/bin/env bun

import { watch } from 'node:fs';
import { exists } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { SpawnOptions } from 'bun';
import getPort, { portNumbers } from 'get-port';

import {
  frameworkDirectory,
  loggingPrefixes,
  pagesDirectory,
} from '@/private/shell/constants';
import { logSpinner, setEnvironmentVariables } from '@/private/shell/utils';

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
  },
  strict: true,
  allowPositionals: true,
});

const isInitializing = positionals.includes('init');
const isBuilding = positionals.includes('build');
const isServing = positionals.includes('serve');
const isDeveloping = !isBuilding && !isServing;

if (isInitializing) {
  const originDirectory = path.join(frameworkDirectory, 'examples', 'basic');
  const targetDirectory = path.join(process.cwd(), 'blade-example');

  const { success, stderr } = Bun.spawnSync([
    'cp',
    '-r',
    originDirectory,
    targetDirectory,
  ]);

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
  port,
  projects,
});

const serverFile = path.join(import.meta.dirname, 'listener.js');

const childProcessConfig: SpawnOptions.OptionsObject = {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...import.meta.env,
    FORCE_COLOR: '3',
  },
};

if (isServing) {
  await import(serverFile);
} else if (isBuilding || isDeveloping) {
  if (isBuilding) {
    // We need to spawn a child process because `Bun.build` requires `BUN_ENV` to be set
    // when the process starts, and since we don't want to require `BUN_ENV` to be set
    // when starting `blade build`, we need a child process that we can set this
    // environment variable on.
    const builder = Bun.spawn(
      ['bun', path.join(__dirname, 'builder.js')],
      childProcessConfig,
    );

    // Wait for the process to exit and obtain its exit code.
    const exitCode = await builder.exited;

    // If the exit code isn't `0`, an error has occurred during the build and we
    // therefore want to exit the parent process with an error code too.
    if (exitCode !== 0) process.exit(1);
  } else {
    // We need to spawn a child process because we want to take advantage of Bun's
    // hot-reloading feature, which refreshes the process whenever files are changing.
    // Since we don't want the client build above to be restarted every time, we need to
    // isolate the server execution.
    Bun.spawn(['bun', '--hot', serverFile], childProcessConfig);

    // In Bun, every file that is processed by a custom Bun loader is not being watched
    // by Bun, since the loader could load the file from any path that Bun might not be
    // aware of.
    //
    // That's why, for those files, we need custom file watchers, which we can delete
    // once Bun has added support for exposing a path to watch from Bun loaders, so that
    // Bun can watch them itself.
    //
    // Below, we are watching the two directories that can contain the affected files.
    // Watching all directories would mean setting up file watchers for ignored paths
    // like `node_modules`, which we don't want to do. We could of course filter them out
    // in the event callback, but the file watchers would still exist and consume
    // resources unnecessarily.
    //
    // More details: https://linear.app/ronin/issue/RON-924
    const handleFileChange: Parameters<typeof watch>[1] = async (_, filename) => {
      if (!filename?.includes('.client.') && !filename?.endsWith('.mdx')) return;
      const file = Bun.file(path.join(pagesDirectory, 'index.tsx'));
      await Bun.write(file, await file.text());
    };

    for (const project of projects) {
      const pagePath = path.join(project, 'pages');
      const componentPath = path.join(project, 'components');

      watch(pagePath, { recursive: true }, handleFileChange);

      if (await exists(componentPath)) {
        watch(componentPath, { recursive: true }, handleFileChange);
      }
    }
  }
}
