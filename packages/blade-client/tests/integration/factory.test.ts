import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Statement, StoredObject } from 'blade-compiler';
import type { ResultRecord } from 'blade-syntax/queries';

import { createSyntaxFactory } from '@/src/index';
import type { StorableObject } from '@/src/types/storage';

describe('factory', () => {
  test('can create multiple factories with different configurations', async () => {
    const factory1 = createSyntaxFactory({ token: 'takashitoken' });

    await factory1.get.accounts();

    expect(mockRequestResolvedValue?.headers.get('Authorization')).toBe(
      'Bearer takashitoken',
    );
    expect(mockResolvedRequestText).toEqual('{"queries":[{"get":{"accounts":{}}}]}');

    const factory2 = createSyntaxFactory({ token: 'supatokken' });

    await factory2.get.members();

    expect(mockRequestResolvedValue?.headers.get('Authorization')).toBe(
      'Bearer supatokken',
    );
    expect(mockResolvedRequestText).toEqual('{"queries":[{"get":{"members":{}}}]}');
  });

  test('can use the custom database caller', async () => {
    const mockDatabaseCaller = mock(() => ({ results: [[]] }));

    const factory = createSyntaxFactory({
      databaseCaller: mockDatabaseCaller,
      models: [{ slug: 'account' }],
      token: 'takashitoken',
    });

    await factory.get.accounts();

    expect(mockDatabaseCaller).toHaveBeenCalledWith(
      [
        {
          sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"`,
          params: [],
          returning: true,
        },
      ],
      'takashitoken',
    );
  });

  test('can use custom database', async () => {
    const mockFetchNew = mock((request) => {
      mockRequestResolvedValue = request;

      return Response.json({
        databaseName: {
          results: [
            {
              record: {
                name: 'Tim',
                createdAt: '2024-04-16T15:02:12.710Z',
                ronin: {
                  updatedAt: '2024-05-16T15:02:12.710Z',
                },
              },
              modelFields: {
                name: 'string',
                createdAt: 'date',
                'ronin.updatedAt': 'date',
              },
            },
          ],
        },
      });
    });

    const factory = createSyntaxFactory({
      fetch: async (request) => mockFetchNew(request),
      token: 'takashitoken',
    });

    const record = await factory.get.account(
      {},
      {
        database: 'databaseName',
      },
    );

    expect(record).toMatchObject({
      name: 'Tim',
      createdAt: new Date('2024-04-16T15:02:12.710Z'),
      ronin: {
        updatedAt: new Date('2024-05-16T15:02:12.710Z'),
      },
    });
  });

  test('can use custom database in batch', async () => {
    const mockFetchNew = mock((request) => {
      mockRequestResolvedValue = request;

      return Response.json({
        databaseName: {
          results: [
            {
              record: {
                name: 'Tim',
                handle: 'tim',
                createdAt: '2024-04-16T15:02:12.710Z',
                ronin: {
                  updatedAt: '2024-05-16T15:02:12.710Z',
                },
              },
              modelFields: {
                name: 'string',
                createdAt: 'date',
                'ronin.updatedAt': 'date',
              },
            },
            {
              record: {
                name: 'David',
                handle: 'david',
                createdAt: '2024-04-16T15:02:12.710Z',
                ronin: {
                  updatedAt: '2024-05-16T15:02:12.710Z',
                },
              },
              modelFields: {
                name: 'string',
                createdAt: 'date',
                'ronin.updatedAt': 'date',
              },
            },
          ],
        },
      });
    });

    const factory = createSyntaxFactory({
      fetch: async (request) => mockFetchNew(request),
      token: 'takashitoken',
    });

    const records = await factory.batch(
      () => [
        factory.get.account.with.handle('tim'),
        factory.get.account.with.handle('david'),
      ],
      { database: 'databaseName' },
    );

    expect(records).toMatchObject([
      {
        name: 'Tim',
        handle: 'tim',
        createdAt: new Date('2024-04-16T15:02:12.710Z'),
        ronin: {
          updatedAt: new Date('2024-05-16T15:02:12.710Z'),
        },
      },
      {
        name: 'David',
        handle: 'david',
        createdAt: new Date('2024-04-16T15:02:12.710Z'),
        ronin: {
          updatedAt: new Date('2024-05-16T15:02:12.710Z'),
        },
      },
    ]);
  });

  test('run correct statements for single `get` query', async () => {
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    await factory.get.accounts();

    expect(mockStatements?.[0]?.sql).toBe(
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"',
    );
  });

  test('run correct statements for consecutive mixed queries', async () => {
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'space',
          fields: { createdAt: { type: 'date' }, memberCount: { type: 'number' } },
        },
        {
          slug: 'account',
          fields: { emailVerified: { type: 'boolean' } },
        },
      ],
    });

    await factory.get.spaces.with({
      createdAt: { lessThan: new Date('2024-04-16T15:02:12.710Z') },
    });

    expect(mockStatements?.[0]?.sql).toBe(
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "createdAt", "memberCount" FROM "spaces" WHERE "createdAt" < ?1',
    );

    await factory.remove.accounts.with({
      emailVerified: { being: false },
    });

    expect(mockStatements?.[0]?.sql).toBe(
      'DELETE FROM "accounts" WHERE "emailVerified" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "emailVerified"',
    );
  });

  test('run correct statements for `get` only `batch`', async () => {
    let mockStatements: Array<Statement> = [];

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[], [], [], [], []] };
      },
      models: [
        { slug: 'account' },
        { slug: 'member', fields: { handle: { type: 'string' } } },
        { slug: 'space' },
      ],
    });

    await factory.batch(() => [
      factory.get.accounts(),
      factory.get.members.with.handle('ronin'),
      factory.get.members.limitedTo(100),
      factory.get.spaces.orderedBy.descending(['ronin.createdAt']),
      factory.get.member.with.id('123'),
    ]);

    expect(mockStatements.map((item) => item.sql)).toEqual([
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "members" WHERE "handle" = ?1',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "members" ORDER BY "ronin.createdAt" DESC LIMIT 101',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "spaces" ORDER BY "ronin.createdAt" DESC',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "members" WHERE "id" = ?1 LIMIT 1',
    ]);
  });

  test('make sure `batch` extracts queries synchronously', async () => {
    const mockStatements: Array<Array<Statement>> = [];

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements.push(statements);

        if (statements[0].sql.startsWith('DELETE')) {
          return { results: [[], []] };
        }

        return { results: [[]] };
      },
      models: [
        { slug: 'account' },
        { slug: 'space' },
        { slug: 'member' },
        { slug: 'user' },
      ],
      token: 'takashitoken',
    });

    // If `batch` does not extract queries synchronously, the following
    // `get` requests will be triggered while the `batch` is still being
    // processed and that in turn will make the `get` requests act like they
    // are in a batch.
    (await Promise.all([
      factory.batch(() => [factory.remove.accounts(), factory.remove.spaces()]),
      factory.get.members(),
      factory.get.users(),
    ])) as any;

    expect(mockStatements).toHaveLength(3);
    expect(mockStatements[0]).toHaveLength(2);
  });

  test('correctly format `amount`', async () => {
    const factory = createSyntaxFactory({
      databaseCaller: () => ({
        results: [
          [
            {
              amount: 10,
            },
          ],
        ],
      }),
      models: [
        {
          slug: 'account',
        },
      ],
    });

    const result = await factory.count.accounts();

    expect(result).toBe(10);
  });

  test('correctly format not found result', async () => {
    const factory = createSyntaxFactory({
      databaseCaller: () => ({
        results: [[]],
      }),
      models: [
        {
          slug: 'account',
        },
      ],
    });

    const result = await factory.get.account();

    expect(result).toBeNull();
  });

  test('upload image', async () => {
    const bunFile = Bun.file('tests/assets/example.jpeg');
    const file = new File([new Uint8Array(await bunFile.arrayBuffer())], 'example.jpeg', {
      type: 'image/jpeg',
    });

    let mockStorableObject: StorableObject | undefined;
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      storageCaller: (object) => {
        mockStorableObject = object;

        return {
          key: 'test-key',
          name: 'example.jpeg',
          src: 'https://storage.ronin.co/test-key',
          meta: {
            height: 100,
            width: 100,
            size: 100,
            type: 'image/jpeg',
          },
          placeholder: {
            base64: '',
          },
        };
      },
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'account',
          fields: { avatar: { type: 'blob' } },
        },
      ],
    });

    await factory.add.account.with.avatar(file);

    expect(mockStorableObject?.contentType).toBe('image/jpeg');

    expect(mockStorableObject?.name).toBe('example.jpeg');
    expect(mockStorableObject?.value).toBe(file);

    expect(mockStatements?.[0]?.sql).toBe(
      'INSERT INTO "accounts" ("avatar", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "avatar"',
    );
    expect(mockStatements?.[0]?.params[0]).toBe(
      '{"key":"test-key","name":"example.jpeg","src":"https://storage.ronin.co/test-key","meta":{"height":100,"width":100,"size":100,"type":"image/jpeg"},"placeholder":{"base64":""}}',
    );
  });

  test('upload video', async () => {
    const bunFile = Bun.file('tests/assets/example.mp4');
    const file = new File([new Uint8Array(await bunFile.arrayBuffer())], 'example.mp4', {
      type: 'video/mp4',
    });

    let mockStorableObject: StorableObject | undefined;
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      storageCaller: (object) => {
        mockStorableObject = object;

        return {
          key: 'test-key',
          name: 'example.mp4',
          src: 'https://storage.ronin.co/test-key',
          meta: {
            size: 100,
            type: 'video/mp4',
          },
          placeholder: null,
        };
      },
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'account',
          fields: { video: { type: 'blob' } },
        },
      ],
    });

    await factory.add.account.with.video(file);

    expect(mockStorableObject?.contentType).toBe('video/mp4');

    expect(mockStorableObject?.name).toBe('example.mp4');
    expect(mockStorableObject?.value).toBe(file);

    expect(mockStatements?.[0]?.sql).toBe(
      'INSERT INTO "accounts" ("video", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "video"',
    );
    expect(mockStatements?.[0]?.params[0]).toBe(
      '{"key":"test-key","name":"example.mp4","src":"https://storage.ronin.co/test-key","meta":{"size":100,"type":"video/mp4"},"placeholder":null}',
    );
  });

  test('handle storage service error', async () => {
    const factory = createSyntaxFactory({
      fetch: async (request) => {
        if ((request as Request).url === 'https://storage.ronin.co/') {
          return new Response('Details here', {
            status: 403,
          });
        }
        return mockFetch(request);
      },
    });

    const promise = factory.add.account({
      with: {
        avatar: new File([''], 'example.jpeg', { type: 'image/jpeg' }),
      },
    });

    expect(promise).rejects.toThrow(
      'An error occurred while uploading the binary objects included in the provided queries. Error: Details here',
    );
  });

  test('format date fields', async () => {
    const mockFetchNew = mock(async (request) => {
      mockRequestResolvedValue = request;

      return Response.json({
        results: [
          {
            record: {
              name: 'Tim',
              createdAt: '2024-04-16T15:02:12.710Z',
              ronin: {
                updatedAt: '2024-05-16T15:02:12.710Z',
              },
            },
            modelFields: {
              name: 'string',
              createdAt: 'date',
              'ronin.updatedAt': 'date',
            },
          },
          {
            records: [
              {
                name: 'Leo',
                createdAt: '2024-04-16T15:02:12.710Z',
                ronin: {
                  updatedAt: '2024-05-16T15:02:12.710Z',
                },
              },
              {
                name: 'Juri',
                createdAt: '2024-04-16T15:02:12.710Z',
                ronin: {
                  updatedAt: '2024-05-16T15:02:12.710Z',
                },
              },
            ],
            modelFields: {
              createdAt: 'date',
              'ronin.updatedAt': 'date',
              name: 'string',
            },
          },
        ],
      });
    });

    const factory = createSyntaxFactory({
      fetch: async (request) => mockFetchNew(request),
    });

    const [account, accounts] = await factory.batch(() => [
      factory.get.account<{
        name: string;
        createdAt: Date;
        ronin: ResultRecord['ronin'];
      }>(),
      factory.get.accounts(),
    ]);

    expect(account.createdAt).toBeInstanceOf(Date);
    expect(account.ronin.updatedAt).toBeInstanceOf(Date);

    expect(account.createdAt.toISOString()).toBe('2024-04-16T15:02:12.710Z');
    expect(account.ronin.updatedAt.toISOString()).toBe('2024-05-16T15:02:12.710Z');

    expect(accounts[0].createdAt).toBeInstanceOf(Date);
    expect(accounts[0].ronin.updatedAt).toBeInstanceOf(Date);

    expect(accounts[0].createdAt.toISOString()).toBe('2024-04-16T15:02:12.710Z');
    expect(accounts[0].ronin.updatedAt.toISOString()).toBe('2024-05-16T15:02:12.710Z');
  });

  test('format expanded results', async () => {
    const mockFetchNew = mock(async (request) => {
      mockRequestResolvedValue = request;

      return Response.json({
        results: [
          {
            models: {
              accounts: {
                records: [
                  {
                    name: 'Elaine',
                    ronin: {
                      createdAt: '2024-04-16T15:02:12.710Z',
                      updatedAt: '2024-05-16T15:02:12.710Z',
                    },
                  },
                ],
                modelFields: {
                  name: 'string',
                  'ronin.createdAt': 'date',
                  'ronin.updatedAt': 'date',
                },
              },
              teams: {
                records: [
                  {
                    name: 'Engineering',
                    ronin: {
                      createdAt: '2024-04-16T15:02:12.710Z',
                      updatedAt: '2024-05-16T15:02:12.710Z',
                    },
                  },
                ],
                modelFields: {
                  name: 'string',
                  'ronin.createdAt': 'date',
                  'ronin.updatedAt': 'date',
                },
              },
            },
          },
        ],
      });
    });

    const factory = createSyntaxFactory({
      fetch: async (request) => mockFetchNew(request),
    });

    const results = await factory.get.all();

    expect(results).toMatchObject({
      accounts: [
        {
          name: 'Elaine',
          ronin: {
            createdAt: new Date('2024-04-16T15:02:12.710Z'),
            updatedAt: new Date('2024-04-16T15:02:12.710Z'),
          },
        },
      ],
      teams: [
        {
          name: 'Engineering',
          ronin: {
            createdAt: new Date('2024-04-16T15:02:12.710Z'),
            updatedAt: new Date('2024-04-16T15:02:12.710Z'),
          },
        },
      ],
    });
  });
});
