import fs from 'node:fs';
import path from 'node:path';
import { formatCode } from '@/src/utils/format';
import { MIGRATIONS_PATH } from '@/src/utils/misc';
import {
  type Model,
  QUERY_SYMBOLS,
  type Query,
  type Statement,
  Transaction,
} from 'blade-compiler';
import { getBatchProxy, getSyntaxProxy } from 'blade-syntax/queries';

/**
 * Protocol represents a set of database migration queries that can be executed in sequence.
 * It provides functionality to generate, save and load migration files and SQL statements.
 */
export class Protocol {
  private _queries: Array<Query> = [];
  private _roninQueries: Array<string>;
  private _protocolDir = MIGRATIONS_PATH;

  /**
   * Creates a new Protocol instance.
   *
   * @param roninQueries - Optional array of RONIN query strings to initialize with.
   */
  constructor(roninQueries: Array<string> = []) {
    this._roninQueries = roninQueries;
  }

  /**
   * Converts RONIN query strings into Query objects.
   *
   * @returns The Protocol instance for chaining.
   */
  async convertToQueryObjects(): Promise<Protocol> {
    this._queries = this._roninQueries.map((queryString) => {
      return this.queryToObject(queryString);
    });

    return this;
  }

  /**
   * Converts a query string into a Query object.
   *
   * @param query - RONIN query string.
   *
   * @returns Object containing the Query and options.
   *
   * @private
   */
  private queryToObject = (query: string): Query => {
    const queryTypes = [
      'get',
      'set',
      'add',
      'remove',
      'count',
      'create',
      'alter',
      'drop',
    ];
    const queryProxies = queryTypes.map((type) => {
      return getSyntaxProxy({ root: `${QUERY_SYMBOLS.QUERY}.${type}` });
    });

    const func = new Function(...queryTypes, `"use strict"; return ${query}`);

    return func(...queryProxies)[QUERY_SYMBOLS.QUERY];
  };

  /**
   * Generates the migration file content.
   *
   * @returns Migration file content as a string.
   * @private
   */
  private createMigrationProtocol = (): string => {
    // Analyze which query types are actually used in the queries
    const queryTypes = [
      'add',
      'alter',
      'create',
      'drop',
      'get',
      'set',
      'remove',
      'count',
    ];
    const usedQueryTypes = new Set<string>();

    for (const query of this._roninQueries) {
      for (const type of queryTypes) {
        if (query.startsWith(`${type}.`)) {
          usedQueryTypes.add(type);
        }

        // We also need to check if a query type is used inside another query.
        // For example: `add.model({slug: 'model1'}).with(() => get.model({slug: 'model2'}))`.
        if (query.includes(` ${type}.`)) {
          usedQueryTypes.add(type);
        }
      }
    }

    const usedQueryTypesArray = Array.from(usedQueryTypes);

    // Only import the query types that are actually used
    const imports =
      usedQueryTypesArray.length > 0
        ? `import { ${usedQueryTypesArray.join(', ')} } from 'blade/schema';`
        : '';

    return `${imports}
    
export default [
  ${this._roninQueries.map((query) => ` ${query}`).join(',\n')}
];`;
  };

  /**
   * Gets the current Query objects.
   */
  get queries(): Array<Query> {
    return this._queries;
  }

  /**
   * Gets the current RONIN query strings.
   */
  get roninQueries(): Array<string> {
    return this._roninQueries;
  }

  /**
   * Loads a protocol from a migration file.
   *
   * @param fileName - Optional name of the migration file to load. If not provided, loads
   * the latest migration.
   *
   * @returns Promise resolving to the Protocol instance
   */
  load = async (fileName?: string): Promise<Protocol> => {
    const targetFile =
      fileName ||
      (() => {
        const files = fs.readdirSync(this._protocolDir);
        return files.sort().pop() || 'migration';
      })();

    const filePath = path.resolve(this._protocolDir, targetFile);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration protocol file ${filePath} does not exist`);
    }

    const queries = await import(filePath);

    const queryObjects = getBatchProxy(() => queries.default());

    this._queries = queryObjects.map((query: { structure: Query }) => query.structure);

    return this;
  };

  /**
   * Saves the protocol to a migration file.
   *
   * @param fileName - Name for the migration file.
   *
   * @returns The Protocol instance for chaining
   */
  save = (fileName: string): Protocol => {
    const migrationContent = this.createMigrationProtocol();
    const directoryPath = path.resolve(this._protocolDir);

    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(
      path.join(directoryPath, `${fileName}.ts`),
      formatCode(migrationContent),
    );

    return this;
  };

  /**
   * Saves the SQL statements to a file.
   *
   * @param fileName - Name for the SQL file.
   * @param models - Models used to compile the queries.
   */
  saveSQL = async (fileName: string, models: Array<Model>): Promise<void> => {
    const statements = this.getSQLStatements(models);
    const sqlContent = statements.map(({ sql }) => sql).join('\n');
    fs.writeFileSync(`${this._protocolDir}/${fileName}.sql`, sqlContent);
  };

  /**
   * Gets the SQL statements for the protocol.
   *
   * @param models - Models used to compile the queries.
   *
   * @returns Array of SQL statements.
   */
  getSQLStatements = (models: Array<Model>): Array<Statement> => {
    return new Transaction(this._queries, {
      models,
      inlineParams: true,
    }).statements;
  };
}
