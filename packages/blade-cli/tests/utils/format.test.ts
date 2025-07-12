import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import {
  colorizeSql,
  detectFormatConfig,
  formatCode,
  formatSqliteStatement,
} from '@/src/utils/format';

describe('format', () => {
  test('detectFormatConfig should return defaults when no config files exist', () => {
    // Mock `fs.existsSync` to return `false` for all config files
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (): boolean => false;

    const config = detectFormatConfig();
    expect(config).toEqual({
      useTabs: false,
      tabWidth: 2,
      singleQuote: true,
      semi: true,
      configSource: 'default',
      quoteProps: 'asNeeded',
    });

    // Restore original
    fs.existsSync = originalExistsSync;
  });

  test('detectFormatConfig should parse biome config', () => {
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;

    fs.existsSync = (filePath: fs.PathLike): boolean =>
      filePath.toString().endsWith('biome.json');
    // @ts-expect-error Override type.
    fs.readFileSync = (_path: fs.PathOrFileDescriptor): string =>
      JSON.stringify({
        formatter: {
          indentStyle: 'tab',
          indentWidth: 3,
        },
        javascript: {
          formatter: {
            quoteStyle: 'single',
            semicolons: 'always',
          },
        },
      });

    const config = detectFormatConfig();
    expect(config).toEqual({
      useTabs: true,
      tabWidth: 3,
      singleQuote: true,
      semi: true,
      configSource: 'biome.json',
      quoteProps: 'asNeeded',
    });

    // Restore originals
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
  });

  test('detectFormatConfig should parse eslint config', () => {
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;

    fs.existsSync = (filePath: fs.PathLike): boolean =>
      filePath.toString().endsWith('.eslintrc.json');
    // @ts-expect-error Override type.
    fs.readFileSync = (_path: fs.PathOrFileDescriptor): string =>
      JSON.stringify({
        rules: {
          indent: ['error', 'tab'],
          quotes: ['error', 'single'],
          semi: ['error'],
        },
      });

    const config = detectFormatConfig();
    expect(config).toEqual({
      useTabs: true,
      tabWidth: 2,
      singleQuote: true,
      semi: true,
      configSource: '.eslintrc.json',
      quoteProps: 'asNeeded',
    });

    // Restore originals
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
  });

  test('detectFormatConfig should parse prettier config', () => {
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;

    fs.existsSync = (filePath: fs.PathLike): boolean =>
      filePath.toString().endsWith('.prettierrc.json');
    // @ts-expect-error Override type.
    fs.readFileSync = (_path: fs.PathOrFileDescriptor): string =>
      JSON.stringify({
        useTabs: true,
        tabWidth: 4,
        singleQuote: false,
        semi: false,
        quoteProps: 'asNeeded',
      });

    const config = detectFormatConfig();
    expect(config).toEqual({
      useTabs: true,
      tabWidth: 4,
      singleQuote: false,
      semi: false,
      configSource: '.prettierrc.json',
      quoteProps: 'asNeeded',
    });

    // Restore originals
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
  });

  test('formatCode should format code according to config', async () => {
    const input = "function test(){return 'hello'}";
    const formatted = await formatCode(input);
    expect(formatted).toContain('function test()');
    expect(formatted).toContain(';');
  });

  test('drop double quotes for object keys', () => {
    const input = 'const test = {"name": "John", "age": 30}';
    const formatted = formatCode(input);
    expect(formatted).toContain('name: "John"');
    expect(formatted).toContain('age: 30');
  });

  test('detectFormatConfig should handle broken config files', () => {
    // Mock fs functions
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;
    const originalConsoleLog = console.log;

    let loggedMessage = '';
    console.log = (msg: string): void => {
      loggedMessage = msg;
    };

    fs.existsSync = (filePath: fs.PathLike): boolean =>
      filePath.toString().endsWith('.prettierrc.json');
    // @ts-expect-error Override type.
    fs.readFileSync = (_path: fs.PathOrFileDescriptor): string =>
      '{ this is not valid JSON }';

    const config = detectFormatConfig();

    // Should fall back to defaults when config is broken.
    expect(config).toEqual({
      useTabs: false,
      tabWidth: 2,
      singleQuote: true,
      semi: true,
      configSource: 'default',
      quoteProps: 'asNeeded',
    });

    // Should log error about broken config.
    expect(loggedMessage).toContain('Error parsing .prettierrc.json:');

    // Restore originals
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
    console.log = originalConsoleLog;
  });

  describe('formatSqliteStatement', () => {
    test('should format CREATE TABLE statement', () => {
      const input = 'CREATE TABLE "users" (id INTEGER PRIMARY KEY, name TEXT)';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toContain('\u001B[1;33mCREATE');
      expect(formatted).toContain(
        '(\n  id INTEGER \u001B[1;33mPRIMARY KEY\u001B[0m, name \u001B[1;33mTEXT\u001B[0m\n);',
      );

      // Test case where match fails.
      const noMatch = formatSqliteStatement('CREATE TABLE invalid');
      expect(noMatch).toBe(colorizeSql('CREATE TABLE invalid'));
    });

    test('should format ALTER TABLE statement', () => {
      const input = 'ALTER TABLE "users" ADD COLUMN "email" TEXT';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toContain('\u001B[1;33mALTER\u001B[0m \u001B[1;33mTABLE\u001B');

      // Test case where match fails.
      const noMatch = formatSqliteStatement('ALTER TABLE invalid');
      expect(noMatch).toBe(colorizeSql('ALTER TABLE invalid'));
    });

    test('should format UPDATE statement', () => {
      const input = 'UPDATE "users" SET name = "John" RETURNING *';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toContain(
        '\u001B[1;33mUPDATE\u001B[0m \u001B[1;36m"users"\u001B[0m\n\u001B[1;33mSET\u001B[0m name = \u001B[1;36m"John"\u001B[0m\n\u001B[1;33mRETURNING\u001B[0m *;',
      );

      // Test case where match fails.
      const noMatch = formatSqliteStatement('UPDATE invalid');
      expect(noMatch).toBe(colorizeSql('UPDATE invalid'));
    });

    test('should format DROP TABLE statement', () => {
      const input = 'DROP TABLE "users"';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toBe(formatSqliteStatement('DROP TABLE "users";'));

      // Test case where match fails.
      const noMatch = formatSqliteStatement('DROP TABLE');
      expect(noMatch).toBe(colorizeSql('DROP TABLE'));
    });

    test('should format INSERT INTO statement', () => {
      const input =
        'INSERT INTO "users" (name, email) VALUES ("John", "john@example.com")';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toContain('\u001B[1;33mINSERT\u001B');

      // Test case where match fails.
      const noMatch = formatSqliteStatement('INSERT INTO invalid');
      expect(noMatch).toBe(colorizeSql('INSERT INTO invalid'));
    });

    test('should colorize SQL keywords', () => {
      const input = 'SELECT * FROM "users" WHERE id = 1';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toContain('\x1b[1;33mSELECT\x1b[0m');
    });

    test('should colorize table names', () => {
      const input = 'SELECT * FROM "users"';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toContain('\x1b[1;36m"users"\x1b[0m');
    });

    test('should colorize string literals', () => {
      const input = "SELECT * FROM users WHERE name = 'John'";
      const formatted = formatSqliteStatement(input);
      expect(formatted).toContain("\x1b[1;32m'John'\x1b[0m");
    });

    test('should handle non-matching statements', () => {
      const input = 'INVALID STATEMENT';
      const formatted = formatSqliteStatement(input);
      expect(formatted).toBe(colorizeSql('INVALID STATEMENT'));
    });
  });
});
