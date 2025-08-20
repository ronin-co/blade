import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFromBuffer } from '@dprint/formatter';

// Top-level regex constants for better performance
const CREATE_TABLE_REGEX = /CREATE TABLE "(.*?)" \((.*?)\)/s;
const COLUMN_SPLIT_REGEX = /,(?= ")/;
const ALTER_TABLE_REGEX = /ALTER TABLE "(.*?)" ADD COLUMN "(.*?)" (.*)/;
const UPDATE_REGEX = /UPDATE "(.*?)" SET (.*?) RETURNING (.*)/;
const DROP_TABLE_REGEX = /DROP TABLE "(.*?)"/;
const INSERT_REGEX = /INSERT INTO "(.*?)" \((.*?)\)(.*)/;
const KEYWORD_REGEX =
  /\b(CREATE|TABLE|ALTER|ADD|COLUMN|INSERT|INTO|SELECT|TEXT|BOOLEAN|DATETIME|DEFAULT|UPDATE|SET|RETURNING|DROP|ON DELETE|ON UPDATE|PRIMARY KEY|REFERENCES)\b/g;
const TABLE_NAME_REGEX = /"([^"]+)"/g;
const STRING_LITERAL_REGEX = /'([^']+)'/g;

/**
 * Detects code formatting configuration from common config files.
 *
 * @returns Object containing detected formatting preferences.
 */
export const detectFormatConfig = (): {
  useTabs: boolean;
  tabWidth: number;
  singleQuote: boolean;
  semi: boolean;
  configSource: string;
  quoteProps: 'asNeeded' | 'preserve' | 'consistent';
} => {
  const configFiles = ['biome.json', '.prettierrc.json', '.eslintrc.json', '.prettierrc'];

  const cwd = process.cwd();

  for (const file of configFiles) {
    const configPath = path.join(cwd, file);

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (file === 'biome.json') {
          return {
            useTabs: config.formatter?.indentStyle === 'tab',
            tabWidth: config.formatter?.indentWidth ?? 2,
            singleQuote: config.javascript?.formatter?.quoteStyle === 'single',
            semi: config.javascript?.formatter?.semicolons === 'always',
            configSource: path.basename(file),
            quoteProps: config.javascript?.formatter?.quoteProps ?? 'asNeeded',
          };
        }

        if (file === '.eslintrc.json') {
          return {
            useTabs: config.rules?.indent?.[1] === 'tab',
            tabWidth:
              typeof config.rules?.indent?.[1] === 'number' ? config.rules.indent[1] : 2,
            singleQuote: config.rules?.quotes?.[1] === 'single',
            semi: config.rules?.semi?.[0] === 'error' || config.rules?.semi?.[0] === 2,
            configSource: path.basename(file),
            quoteProps: config.rules?.['quote-props']?.[1] ?? 'asNeeded',
          };
        }

        // For .prettierrc.json
        return {
          useTabs: config.useTabs ?? false,
          tabWidth: config.tabWidth ?? 2,
          singleQuote: config.singleQuote ?? true,
          semi: config.semi ?? true,
          configSource: path.basename(file),
          quoteProps: config.quoteProps ?? 'asNeeded',
        };
      } catch (err) {
        console.log(`Error parsing ${file}: ${err}`);
      }
    }
  }

  // Return defaults if no config found
  return {
    useTabs: false,
    tabWidth: 2,
    singleQuote: true,
    semi: true,
    configSource: 'default',
    quoteProps: 'asNeeded',
  };
};

export const formatCode = (code: string): string => {
  const config = detectFormatConfig();
  const wasmPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    'plugin.wasm',
  );
  const buffer = fs.readFileSync(wasmPath);
  const formatter = createFromBuffer(buffer);

  const formated = formatter.formatText({
    filePath: '.migration.ts',
    fileText: code,
    overrideConfig: {
      parser: 'typescript',
      useTabs: config.useTabs,
      tabWidth: config.tabWidth,
      singleQuote: config.singleQuote,
      semi: config.semi,
      quoteProps: config.quoteProps,
    },
  });

  return formated;
};

/**
 * Formats a SQLite statement by adding proper indentation and line breaks.
 * Also applies syntax highlighting for console output.
 *
 * @param statement - The SQLite statement to format.
 *
 * @returns The formatted and colorized SQL statement as a string.
 *
 * @example
 * ```typescript
 * formatSqliteStatement('CREATE TABLE "users" (id INTEGER PRIMARY KEY, name TEXT)')
 * // Returns colorized:
 * // CREATE TABLE "users" (
 * //   id INTEGER PRIMARY KEY,
 * //   name TEXT
 * // );
 * ```
 */
export const formatSqliteStatement = (statement: string): string => {
  if (statement.startsWith('CREATE TABLE')) {
    const match = statement.match(CREATE_TABLE_REGEX);
    if (match) {
      const tableName = match[1];
      const columns = match[2]
        .split(COLUMN_SPLIT_REGEX)
        .map((col, index) => (index === 0 ? col.trim() : `\n  ${col.trim()}`))
        .join(', ');

      return colorizeSql(`CREATE TABLE "${tableName}" (\n  ${columns}\n);`);
    }
  }

  if (statement.startsWith('ALTER TABLE')) {
    const match = statement.match(ALTER_TABLE_REGEX);
    if (match) {
      return colorizeSql(
        `ALTER TABLE "${match[1]}"\n  ADD COLUMN "${match[2]}" ${match[3]};`,
      );
    }
  }

  if (statement.startsWith('UPDATE')) {
    const match = statement.match(UPDATE_REGEX);
    if (match) {
      return colorizeSql(`UPDATE "${match[1]}"\nSET ${match[2]}\nRETURNING ${match[3]};`);
    }
  }

  if (statement.startsWith('DROP TABLE')) {
    const match = statement.match(DROP_TABLE_REGEX);
    if (match) {
      return colorizeSql(`DROP TABLE "${match[1]}";`);
    }
  }

  if (statement.startsWith('INSERT INTO')) {
    const match = statement.match(INSERT_REGEX);
    if (match) {
      return colorizeSql(`INSERT INTO "${match[1]}"\n  (${match[2]})\n${match[3]};`);
    }
  }

  return colorizeSql(statement);
};

/**
 * Adds ANSI color codes to SQL keywords, table names, and string literals for console
 * output.
 *
 *
 * @param sql - The SQL statement to colorize.
 * @returns The SQL statement with ANSI color codes added.
 *
 * @example
 * ```typescript
 * colorizeSql('SELECT * FROM "users"')
 * // Returns string with ANSI codes for yellow keywords and cyan table names
 * ```
 */
export const colorizeSql = (sql: string): string => {
  const colors = {
    keyword: '\x1b[1;33m', // Bold Yellow
    table: '\x1b[1;36m', // Bold Cyan
    string: '\x1b[1;32m', // Bold Green
    reset: '\x1b[0m', // Reset color
  };

  return sql
    .replace(KEYWORD_REGEX, `${colors.keyword}$1${colors.reset}`)
    .replace(TABLE_NAME_REGEX, `${colors.table}"$1"${colors.reset}`)
    .replace(STRING_LITERAL_REGEX, `${colors.string}'$1'${colors.reset}`);
};
