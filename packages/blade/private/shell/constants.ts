import path from 'node:path';
import chalk from 'chalk';
import gradient from 'gradient-string';

export const pagesDirectory = path.resolve(process.cwd(), 'pages');
export const componentsDirectory = path.resolve(process.cwd(), 'components');
export const triggersDirectory = path.resolve(process.cwd(), 'triggers');
export const publicDirectory = path.resolve(process.cwd(), 'public');

export const frameworkDirectory = path.join(__dirname, '..', '..', '..');

export const directoriesToParse = {
  pages: pagesDirectory,
  triggers: triggersDirectory,
};

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
