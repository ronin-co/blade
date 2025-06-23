#!/usr/bin/env node

import { parseArgs } from 'node:util';

async function main(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: process.argv,
    options: {},
    strict: true,
  });
  console.log({
    positionals,
    values,
  });
}

main().catch(console.error);
