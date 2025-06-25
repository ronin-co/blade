import chalk from 'chalk';
import ora from 'ora';

import { gradient } from './string';

import type { Ora } from 'ora';

export const loggingPrefixes = {
  info: `${chalk.bold(gradient(['#473b7b', '#3584a7', '#30d2be'])('BLADE'))} `,
  error: `${chalk.bold(gradient(['#930024', '#d4143e'])('ERROR'))}  `,
};

export const logSpinner = (text: string): Ora =>
  ora({
    // Make CTRL+C work as expected.
    discardStdin: false,
    prefixText: loggingPrefixes.info,
    text,
  });
