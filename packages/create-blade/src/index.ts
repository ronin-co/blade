#!/usr/bin/env node

import { parseArgs } from 'node:util';

import pkg from '@/package.json';

import { logSpinner, loggingPrefixes } from '@/utils/log';

const TEMPLATES = ['advanced', 'basic'] as const;

type Template = (typeof TEMPLATES)[number];

async function main(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  const { values } = parseArgs({
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
    console.log(`
Usage: create-blade [directory] [options]

Options:
  -v, --version           Output the current version of create-blade.
  -h, --help              Display this help message.
`);
    process.exit(0);
  }

  if (!TEMPLATES.includes(values.template as Template)) {
    console.error(loggingPrefixes.error, `Invalid template "${values.template}"`);
    console.error(loggingPrefixes.error, 'Available templates:', TEMPLATES.join(', '));
    process.exit(1);
  }

  const spinner = logSpinner('Creating a new Blade project...').start();
  spinner.succeed();
}

main().catch(console.error);
