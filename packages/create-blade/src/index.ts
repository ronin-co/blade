#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    logSpinner('Successfully created example app').succeed();
  } catch (error) {
    logSpinner('Failed to create example app').fail();
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
