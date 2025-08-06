import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import gradient from 'gradient-string';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = join(dirname(currentFilePath), '..', 'private');

export const publicDirectory = resolve(process.cwd(), 'public');
export const outputDirectory = resolve(process.cwd(), '.blade');

// The path at which people can define a custom Hono app that Blade will mount.
export const routerInputFile = join(process.cwd(), 'router.ts');

export const styleInputFile = join(process.cwd(), 'styles.css');
export const clientInputFile = join(currentDirPath, 'client/index.js');

export const serverInputFolder = join(currentDirPath, 'server/worker/providers');

export const loggingPrefixes = {
  info: `${chalk.bold(gradient(['#473b7b', '#3584a7', '#30d2be'])('BLADE'))} `,
  error: `${chalk.bold(gradient(['#930024', '#d4143e'])('ERROR'))}  `,
};

export const defaultCacheControl = 'public, max-age=31536000, immutable';
export const defaultDeploymentProvider = 'edge-worker';
