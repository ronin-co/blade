import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { $ } from 'bun';

describe('CLI Integration Tests', () => {
  let tempDir: string;
  let originalDir: string;
  const CLI_PATH = path.resolve(process.cwd(), 'tests/fixtures/cli.ts');

  beforeEach(async () => {
    // Save original directory to return to it later
    originalDir = process.cwd();

    // Create a temporary directory for testing
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ronin-cli-test-'));

    // Change to the temporary directory
    process.chdir(tempDir);

    // Create a minimal package.json
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2),
    );
  });

  afterEach(async () => {
    // Change back to the original directory before cleaning up
    process.chdir(originalDir);

    // Clean up the temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  test('should show help text when run without arguments', async () => {
    const { stdout, exitCode } = await $`RONIN_TOKEN=test bun ${CLI_PATH}`
      .nothrow()
      .quiet();

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toContain('Data at the edge');
  });

  test('should show version when run with --version flag', async () => {
    const { stdout, exitCode } = await $`bun ${CLI_PATH} --version`.nothrow().quiet();

    expect(exitCode).toBe(0);
    expect(stdout.toString()).toMatch(/\d+\.\d+\.\d+/); // Matches semver format
  });
});
