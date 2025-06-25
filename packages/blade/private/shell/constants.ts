import path from 'node:path';
import { gradient } from '@ronin/blade-utils/string';
import chalk from 'chalk';

export const publicDirectory = path.resolve(process.cwd(), 'public');
export const outputDirectory = path.resolve(process.cwd(), '.blade');

// The path at which people can define a custom Hono app that Blade will mount.
export const routerInputFile = path.join(process.cwd(), 'router.ts');

export const styleInputFile = path.join(process.cwd(), 'styles.css');
export const clientInputFile = require.resolve('./private/client/index.js');

const serverInputFile = require.resolve(
  './private/server/worker/providers/edge-worker.js',
);
export const serverInputFolder = path.dirname(serverInputFile);

export const loggingPrefixes = {
  info: `${chalk.bold(gradient(['#473b7b', '#3584a7', '#30d2be'])('BLADE'))} `,
  error: `${chalk.bold(gradient(['#930024', '#d4143e'])('ERROR'))}  `,
};

export const defaultDeploymentProvider = 'edge-worker';
