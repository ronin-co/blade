import { afterEach, describe, expect, jest, spyOn, test } from 'bun:test';
import fs, { type PathOrFileDescriptor } from 'node:fs';
import { BLADE_CONFIG_DIR } from '@/src/utils/misc';
import { Protocol } from '@/src/utils/protocol';
import type { Model, Statement } from 'blade-compiler';

describe('protocol', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with empty queries when none are provided', async () => {
    const protocol = new Protocol();
    expect(protocol.queries).toEqual([]);
  });

  test('should initialize with provided queries', async () => {
    const queries = ["create.model({slug: 'model', pluralSlug: 'models'})"];
    const protocol = new Protocol(queries);
    expect(protocol.queries).toEqual([]);
    expect(protocol.roninQueries).toEqual(queries);
  });

  test('save method should write migration file to disk', async () => {
    const queries = ["create.model.to({slug: 'my_model', pluralSlug: 'my_models'})"];
    const protocol = new Protocol(queries);
    const fileName = 'migration_test';

    // Mock `fs.writeFileSync`
    const originalWriteFileSync = fs.writeFileSync;
    let writeFileSyncCalled = false;

    fs.writeFileSync = (
      path: PathOrFileDescriptor,
      data: string | NodeJS.ArrayBufferView,
    ): void => {
      writeFileSyncCalled = true;
      expect(path).toBe(`${process.cwd()}/${BLADE_CONFIG_DIR}/migrations/${fileName}.ts`);
      expect(data).toContain(
        'create.model.to({ slug: "my_model", pluralSlug: "my_models" })',
      );
    };

    protocol.save(fileName);
    expect(writeFileSyncCalled).toBe(true);

    // Restore `fs.writeFileSync`
    fs.writeFileSync = originalWriteFileSync;
  });

  test('saveSQL method should write SQL statements to disk', async () => {
    const queries = ["create.model({slug: 'my_model', pluralSlug: 'my_models'})"];
    const protocol = new Protocol(queries);
    const fileName = 'migration_sql_test';
    const models: Array<Model> = [];

    // Mock `getSQLStatements`
    const originalGetSQLStatements = protocol.getSQLStatements;
    protocol.getSQLStatements = (): Array<Statement> => [
      {
        sql: 'CREATE SCHEMA my_schema;',
        params: [],
      },
    ];

    // Mock `fs.writeFileSync`
    const originalWriteFileSync = fs.writeFileSync;
    let writeFileSyncCalled = false;

    fs.writeFileSync = (
      path: PathOrFileDescriptor,
      data: string | ArrayBufferView,
    ): void => {
      writeFileSyncCalled = true;
      expect(path).toBe(
        `${process.cwd()}/${BLADE_CONFIG_DIR}/migrations/${fileName}.sql`,
      );
      expect(data).toBe('CREATE SCHEMA my_schema;');
    };

    await protocol.saveSQL(fileName, models);
    expect(writeFileSyncCalled).toBe(true);

    // Restore mocks
    fs.writeFileSync = originalWriteFileSync;
    protocol.getSQLStatements = originalGetSQLStatements;
  });

  test('get SQL statements', async () => {
    const queries: Array<string> = ["get.account.with({handle: 'elaine'});"];

    const models: Array<Model> = [
      {
        slug: 'account',
        fields: {
          handle: {
            type: 'string',
          },
        },
      },
    ];
    const protocol = await new Protocol(queries).convertToQueryObjects();

    const statements = protocol.getSQLStatements(models);

    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toStrictEqual(
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" WHERE "handle" = \'elaine\' LIMIT 1',
    );
  });

  test('migration file should only import used query types', async () => {
    const fileName = 'migration_imports_test';

    // Test with only create queries
    const createQueries = [
      "create.model({slug: 'model1'})",
      "create.model({slug: 'model2'})",
    ];
    const createProtocol = new Protocol(createQueries);

    // Mock `fs.mkdirSync` and `fs.writeFileSync`
    spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const writeFileSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    createProtocol.save(fileName);

    // Check the content of the first call to `fs.writeFileSync`
    const createFileContent = writeFileSpy.mock.calls[0][1] as string;
    expect(createFileContent).toContain('import { create } from "blade/schema";');
    expect(createFileContent).not.toContain('get');
    expect(createFileContent).not.toContain('set');

    // Reset mocks for the second test
    jest.clearAllMocks();

    // Test with mixed query types
    const mixedQueries = [
      "create.model({slug: 'model'})",
      'get.account.with({id: 1})',
      "set.account.with({id: 1}).to({name: 'New Name'})",
    ];
    const mixedProtocol = new Protocol(mixedQueries);

    // Re-mock the filesystem functions
    spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const mixedWriteFileSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    mixedProtocol.save(fileName);

    // Check the content of the first call to `fs.writeFileSync`
    const mixedFileContent = mixedWriteFileSpy.mock.calls[0][1] as string;
    expect(mixedFileContent).toContain(
      'import { create, get, set } from "blade/schema";',
    );
    expect(mixedFileContent).not.toContain('alter');
    expect(mixedFileContent).not.toContain('drop');
  });

  test('migration file should only import used query types with subqueries', async () => {
    const fileName = 'migration_imports_test';

    const createQueries = [
      "create.model({slug: 'model1'})",
      "create.model({slug: 'model2'})",
      "add.model({slug: 'model1'}).with(() => get.model({slug: 'model2'}))",
    ];
    const createProtocol = new Protocol(createQueries);

    spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const writeFileSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    createProtocol.save(fileName);

    const createFileContent = writeFileSpy.mock.calls[0][1] as string;
    expect(createFileContent).toContain(
      'import { add, create, get } from "blade/schema";',
    );
  });

  test('load specific migration file', async () => {
    // Path to this file is `./tests/fixtures/protocol.ts`
    const fileName = `${process.cwd()}/tests/fixtures/protocol.ts`;

    const protocol = new Protocol();
    await protocol.load(fileName);
    expect(protocol.queries).toHaveLength(1);
    expect(JSON.stringify(protocol.queries[0])).toStrictEqual(
      JSON.stringify({
        get: {
          account: {
            with: {
              handle: 'elaine',
            },
          },
        },
      }),
    );
  });

  test('load latest migration file', async () => {
    const protocol = new Protocol();
    try {
      await protocol.load();
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('Migration protocol file');
    }
  });
});
