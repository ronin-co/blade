import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { createSyntaxFactory } from '@/src/index';
import type { StorableObject } from '@/src/types/storage';
import type { Statement, StoredObject } from 'blade-compiler';
import type { ResultRecord } from 'blade-syntax/queries';

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

  test('send correct `queries` for single `get` request', async () => {
    await get.accounts();

    expect(mockResolvedRequestText).toEqual('{"queries":[{"get":{"accounts":{}}}]}');
  });

  test('send correct `queries` for consecutive mixed requests', async () => {
    await get.accounts();

    expect(mockResolvedRequestText).toEqual('{"queries":[{"get":{"accounts":{}}}]}');

    await get.spaces({
      with: {
        createdAt: {
          lessThan: new Date('2024-04-16T15:02:12.710Z'),
        },
      },
      using: ['members'],
      orderedBy: {
        ascending: ['createdAt'],
      },
    });

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"spaces":{"with":{"createdAt":{"lessThan":"2024-04-16T15:02:12.710Z"}},"using":["members"],"orderedBy":{"ascending":["createdAt"]}}}}]}',
    );

    // @ts-expect-error `emailVerified` is undefined due not not having the schema types.
    await remove.accounts.with.emailVerified(false);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"remove":{"accounts":{"with":{"emailVerified":false}}}}]}',
    );

    // @ts-expect-error `greaterThan` is undefined due not not having the schema types.
    await count.spaces.with.membersCount.greaterThan(10);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"count":{"spaces":{"with":{"membersCount":{"greaterThan":10}}}}}]}',
    );

    await set.members({
      with: {
        createdAt: {
          lessThan: new Date('2024-04-16T15:02:12.710Z'),
        },
        paid: true,
      },
      to: {
        status: 'active',
        activeFrom: new Date('2024-04-16T15:02:12.710Z'),
      },
    });

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"set":{"members":{"with":{"createdAt":{"lessThan":"2024-04-16T15:02:12.710Z"},"paid":true},"to":{"status":"active","activeFrom":"2024-04-16T15:02:12.710Z"}}}}]}',
    );
  });

  test('send correct `queries` for `get` only `batch` request', async () => {
    await batch((() => [
      get.accounts(),
      // @ts-expect-error `startingWith` is undefined due not not having the
      // schema types.
      get.members.with.handle.startingWith('ronin'),
      get.spaces({
        with: {
          createdAt: {
            lessThan: new Date('2024-04-16T15:02:12.710Z'),
          },
        },
        using: ['members'],
        orderedBy: {
          ascending: ['createdAt'],
        },
      }),
      get.members.limitedTo(100),
      get.spaces.orderedBy.descending(['handle']),
      get.member.with.id('123'),
    ]) as Parameters<typeof batch>[0]);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"accounts":{}}},{"get":{"members":{"with":{"handle":{"startingWith":"ronin"}}}}},{"get":{"spaces":{"with":{"createdAt":{"lessThan":"2024-04-16T15:02:12.710Z"}},"using":["members"],"orderedBy":{"ascending":["createdAt"]}}}},{"get":{"members":{"limitedTo":100}}},{"get":{"spaces":{"orderedBy":{"descending":["handle"]}}}},{"get":{"member":{"with":{"id":"123"}}}}]}',
    );
  });

  test('send correct `queries` for mixed `batch` request', async () => {
    await batch((() => [
      set.members({
        with: {
          createdAt: {
            lessThan: new Date('2024-04-16T15:02:12.710Z'),
          },
          paid: true,
        },
        to: {
          status: 'active',
          activeFrom: new Date('2024-04-16T15:02:12.710Z'),
        },
      }),
      get.accounts(),
      // @ts-expect-error `notBeing` is undefined due not not having the
      // schema types.
      count.spaces.with.membersCount.notBeing(0),
      // @ts-expect-error `emailVerified` is undefined due not not having the
      // schema types.
      remove.accounts.with.emailVerified(false),
      add.spaces({
        with: { handle: 'test-space', members: ['member1', 'member2'] },
      }),
    ]) as Parameters<typeof batch>[0]);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"set":{"members":{"with":{"createdAt":{"lessThan":"2024-04-16T15:02:12.710Z"},"paid":true},"to":{"status":"active","activeFrom":"2024-04-16T15:02:12.710Z"}}}},{"get":{"accounts":{}}},{"count":{"spaces":{"with":{"membersCount":{"notBeing":0}}}}},{"remove":{"accounts":{"with":{"emailVerified":false}}}},{"add":{"spaces":{"with":{"handle":"test-space","members":["member1","member2"]}}}}]}',
    );
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

  test('send correct `queries` for single `get` request using `with`', async () => {
    // @ts-expect-error `startingWith` is undefined due not not having the schema types.
    await get.accounts.with.handle.startingWith('a');

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"accounts":{"with":{"handle":{"startingWith":"a"}}}}}]}',
    );
  });

  test('send correct `queries` for consecutive mixed requests using `with`', async () => {
    await get.accounts();

    expect(mockResolvedRequestText).toEqual('{"queries":[{"get":{"accounts":{}}}]}');

    await get.spaces({
      with: {
        createdAt: {
          lessThan: new Date('2024-04-16T15:02:12.710Z'),
        },
      },
      using: ['members'],
      orderedBy: {
        ascending: ['createdAt'],
      },
    });

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"spaces":{"with":{"createdAt":{"lessThan":"2024-04-16T15:02:12.710Z"}},"using":["members"],"orderedBy":{"ascending":["createdAt"]}}}}]}',
    );

    // @ts-expect-error `emailVerified` is undefined due not not having the schema types.
    await remove.accounts.with.emailVerified(false);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"remove":{"accounts":{"with":{"emailVerified":false}}}}]}',
    );

    // @ts-expect-error `greaterThan` is undefined due not not having the schema types.
    await count.spaces.with.membersCount.greaterThan(10);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"count":{"spaces":{"with":{"membersCount":{"greaterThan":10}}}}}]}',
    );

    await set.members({
      with: {
        createdAt: {
          lessThan: new Date('2024-04-16T15:02:12.710Z'),
        },
        paid: true,
      },
      to: {
        status: 'active',
        activeFrom: new Date('2024-04-16T15:02:12.710Z'),
      },
    });

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"set":{"members":{"with":{"createdAt":{"lessThan":"2024-04-16T15:02:12.710Z"},"paid":true},"to":{"status":"active","activeFrom":"2024-04-16T15:02:12.710Z"}}}}]}',
    );
  });

  test('send correct `queries` for mixed `batch` request using `with`', async () => {
    await batch((() => [
      set.members({
        with: {
          createdAt: {
            lessThan: new Date('2024-04-16T15:02:12.710Z'),
          },
          paid: true,
        },
        to: {
          status: 'active',
          activeFrom: new Date('2024-04-16T15:02:12.710Z'),
        },
      }),
      get.accounts(),
      // @ts-expect-error `notBeing` is undefined due not not having the
      // schema types.
      count.spaces.with.membersCount.notBeing(0),
      // @ts-expect-error `emailVerified` is undefined due not not having the
      // schema types.
      remove.accounts.with.emailVerified(false),
      add.spaces({
        with: { handle: 'test-space', members: ['member1', 'member2'] },
      }),
    ]) as Parameters<typeof batch>[0]);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"set":{"members":{"with":{"createdAt":{"lessThan":"2024-04-16T15:02:12.710Z"},"paid":true},"to":{"status":"active","activeFrom":"2024-04-16T15:02:12.710Z"}}}},{"get":{"accounts":{}}},{"count":{"spaces":{"with":{"membersCount":{"notBeing":0}}}}},{"remove":{"accounts":{"with":{"emailVerified":false}}}},{"add":{"spaces":{"with":{"handle":"test-space","members":["member1","member2"]}}}}]}',
    );
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
    });

    await factory.add.account.with.avatar(file);

    expect(mockStorableObject?.contentType).toBe('image/jpeg');

    expect(mockStorableObject?.name).toBe('example.jpeg');
    expect(mockStorableObject?.value).toBe(file);

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"add":{"account":{"with":{"avatar":{"key":"test-key","name":"example.jpeg","src":"https://storage.ronin.co/test-key","meta":{"height":100,"width":100,"size":100,"type":"image/jpeg"},"placeholder":{"base64":""}}}}}}]}',
    );
  });

  test('upload image with non-latin file name', async () => {
    const bunFile = Bun.file('tests/assets/example.jpeg');

    const file = new File(
      [new Uint8Array(await bunFile.arrayBuffer())],
      'тестування.jpeg',
      {
        type: 'image/jpeg',
      },
    );

    let mockResolvedStorageRequest: Request | undefined;

    const factory = createSyntaxFactory({
      fetch: async (request) => {
        if ((request as Request).url === 'https://storage.ronin.co/') {
          mockResolvedStorageRequest = request as Request;

          const responseBody: StoredObject = {
            key: 'test-key',
            name: file.name,
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

          return Response.json(responseBody);
        }

        return mockFetch(request);
      },
    });

    await factory.add.account({
      with: {
        avatar: file,
      },
    });

    expect(
      (mockResolvedStorageRequest as Request | undefined)?.headers.get(
        'Content-Disposition',
      ),
    ).toBe(
      'form-data; filename="%D1%82%D0%B5%D1%81%D1%82%D1%83%D0%B2%D0%B0%D0%BD%D0%BD%D1%8F.jpeg"',
    );
  });

  test('upload video', async () => {
    const bunFile = Bun.file('tests/assets/example.mp4');
    const file = new File([new Uint8Array(await bunFile.arrayBuffer())], 'example.mp4', {
      type: 'video/mp4',
    });

    let mockResolvedStorageRequest: Request | undefined;

    const factory = createSyntaxFactory({
      fetch: async (request) => {
        if ((request as Request).url === 'https://storage.ronin.co/') {
          mockResolvedStorageRequest = request as Request;

          const responseBody: StoredObject = {
            key: 'test-key',
            name: 'example.mp4',
            src: 'https://storage.ronin.co/test-key',
            meta: {
              size: 100,
              type: 'video/mp4',
            },
            placeholder: null,
          };

          return Response.json(responseBody);
        }

        return mockFetch(request);
      },
    });

    await factory.add.account({
      with: {
        video: file,
      },
    });

    const body = await (mockResolvedStorageRequest as Request | undefined)?.text();

    expect(
      (mockResolvedStorageRequest as Request | undefined)?.headers.get('Content-Type'),
    ).toBe('video/mp4');
    expect(
      (mockResolvedStorageRequest as Request | undefined)?.headers.get(
        'Content-Disposition',
      ),
    ).toBe('form-data; filename="example.mp4"');
    expect(body).toBe(await file.text());

    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"add":{"account":{"with":{"video":{"key":"test-key","name":"example.mp4","src":"https://storage.ronin.co/test-key","meta":{"size":100,"type":"video/mp4"},"placeholder":null}}}}}]}',
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
