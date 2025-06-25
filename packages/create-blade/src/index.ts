#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import pkg from '@/package.json';

import { logSpinner, loggingPrefixes } from '@/utils/log';

const TEMPLATES = ['advanced', 'basic'] as const;
type Template = (typeof TEMPLATES)[number];

const HELP_MESSAGE = `
Usage: create-blade [name] [options]

Options:
  -h, --help                  Display this help message.
  -T, --template <name>       Specify the template to use (default: basic).
  -v, --version               Output the current version of create-blade.
`;

async function main(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));

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
    console.error(loggingPrefixes.error, `Invalid template "${values.template}"`);
    console.error(loggingPrefixes.error, 'Available templates:', TEMPLATES.join(', '));
    process.exit(1);
  }

  // Note that we're slicing out the first two positionals,
  // which are the command name and the script name.
  const projectName = positionals.slice(2).at(-1) ?? 'blade-example';

  if (existsSync(path.join(process.cwd(), projectName))) {
    console.error(
      loggingPrefixes.error,
      `A directory named \`${projectName}\` already exists.`,
    );
    console.error(
      loggingPrefixes.error,
      'Please choose a different name or remove the existing directory.',
    );
    process.exit(1);
  }

  const spinner = logSpinner('Creating a new Blade project...').start();
  spinner.succeed();
}

main().catch(console.error);
