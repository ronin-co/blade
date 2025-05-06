import path from 'node:path';

import chalk from 'chalk';
import gradient from 'gradient-string';

export const pagesDirectory = path.resolve(process.cwd(), 'pages');
export const componentsDirectory = path.resolve(process.cwd(), 'components');
export const triggersDirectory = path.resolve(process.cwd(), 'triggers');
export const publicDirectory = path.resolve(process.cwd(), 'public');

export const frameworkDirectory = path.join(__dirname, '..', '..');

export const directoriesToParse = {
  customPages: pagesDirectory,
  customTriggers: triggersDirectory,
  defaultPages: path.join(frameworkDirectory, 'private/server/pages'),
};

export const outputDirectory = path.resolve(process.cwd(), '.blade');

export const clientManifestFile = path.join(outputDirectory, 'client-manifest.json');

export const serverOutputFile = path.join(outputDirectory, '_worker.js');
export const serverInputFile = require.resolve('../server/worker/index.ts');
export const serverVercelInputFile = require.resolve('../server/worker/vercel.ts');

export const loggingPrefixes = {
  info: `${chalk.bold(gradient(['#473b7b', '#3584a7', '#30d2be'])('BLADE'))} `,
  error: `${chalk.bold(gradient(['#930024', '#d4143e'])('ERROR'))}  `,
};
