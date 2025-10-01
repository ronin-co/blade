#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import chalk from 'chalk';
import gradient from 'gradient-string';
import ora from 'ora';

import pkg from '@/package.json';

import type { Ora } from 'ora';

const TEMPLATES = ['advanced', 'basic'] as const;
type Template = (typeof TEMPLATES)[number];

const LOG_PREFIX = {
  info: `${chalk.bold(gradient(['#473b7b', '#3584a7', '#30d2be'])('BLADE'))} `,
  error: `${chalk.bold(gradient(['#930024', '#d4143e'])('ERROR'))}  `,
};
const logSpinner = (text: string): Ora =>
  ora({
    // Make CTRL+C work as expected.
    discardStdin: false,
    prefixText: LOG_PREFIX.info,
    text,
  });

const HELP_MESSAGE = `
Usage: create-blade [name] [options]

Options:
  -h, --help                  Display this help message.
  -T, --template <name>       Specify the template to use (default: basic).
  -v, --version               Output the current version of create-blade.
`;

async function main(): Promise<void> {
  console.log('Input `process.argv`', process.argv);

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: process.argv,
    options: {
      help: {
        default: false,
        short: 'h',
        type: 'boolean',
      },
      template: {
        default: 'basic' satisfies Template,
        short: 'T',
        type: 'string',
      },
      version: {
        default: false,
        short: 'v',
        type: 'boolean',
      },
    },
    strict: true,
  });

  if (values.version) {
    console.log(pkg.version);
    process.exit(0);
  }

  if (values.help) {
    console.log(HELP_MESSAGE);
    process.exit(0);
  }

  if (!TEMPLATES.includes(values.template as Template)) {
    console.error(LOG_PREFIX.error, `Invalid template "${values.template}"`);
    console.error(LOG_PREFIX.error, 'Available templates:', TEMPLATES.join(', '));
    process.exit(1);
  }

  // Note that we're slicing out the first two positionals,
  // which are the command name and the script name.
  const projectName = positionals.slice(2).at(-1) ?? 'blade-example';

  if (existsSync(path.join(process.cwd(), projectName))) {
    logSpinner(
      `Failed to create example app. A directory named \`${projectName}\` already exists`,
    ).fail();
    process.exit(1);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const directory = {
    origin: path.join(__dirname, '..', 'templates', values.template),
    target: path.join(process.cwd(), projectName),
  };

  try {
    await cp(directory.origin, directory.target, {
      errorOnExist: true,
      recursive: true,
    });

    // Note: npm ignores all `.gitignore` files by default. But even when explicitly told
    // to include them, it still ignores them. So we need to create this file manually.
    await writeFile(
      path.join(directory.target, '.gitignore'),
      `# Build output
.blade/dist/

# Dependencies
node_modules`,
    );

    logSpinner('Successfully created example app').succeed();
  } catch (error) {
    logSpinner('Failed to create example app').fail();
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
