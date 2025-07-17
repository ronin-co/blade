import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { createSyntaxFactory } from '@/src/index';
import { runQueriesWithStorageAndTriggers } from '@/src/queries';
import {
  type AddTrigger,
  type FilteredTriggerQuery,
  type FollowingAddTrigger,
  type ResolvingAddTrigger,
  runQueriesWithTriggers,
} from '@/src/utils/triggers';
import type { CombinedInstructions, Query, QueryType } from 'blade-compiler';

let mockResolvedRequestText: any;

const mockFetch = mock(async (request) => {
  mockResolvedRequestText = await request.text();

  return Response.json({
    results: [],
  });
});

global.fetch = mockFetch;

describe('triggers', () => {
  beforeEach(() => {
    mockFetch.mockClear();

    mockResolvedRequestText = undefined;
  });

  test('run `get` query with a trigger and ensure the trigger does not modify the original query', async () => {
    const query = {
      get: {
        accounts: {
          with: {
            email: {
              endingWith: 'ronin.co',
            },
          },
        },
      },
    };

    const mockTrigger = mock((query: CombinedInstructions) => {
      query.with = {
        handle: 'juri',
      };
      return {};
    });

    await runQueriesWithTriggers([{ query }], {
      triggers: {
        account: {
          resolvingGet: mockTrigger as any,
        },
      },
    });

    expect(mockTrigger).toHaveBeenCalled();
    expect(query.get.accounts.with).not.toHaveProperty('handle');
  });

  test('run `get` query through factory containing `during` trigger', async () => {
    const { get } = createSyntaxFactory({
      triggers: {
        account: {
          get(query, multiple) {
            if (multiple) {
              query.with = {
                email: {
                  endingWith: '@ronin.co',
                },
              };
            } else {
              query.with = {
                handle: 'leo',
              };
            }

            return query;
          },
        },
      },
    });

    await get.account.with.handle('juri');
    // Make sure `leo` is resolved as the account handle.
    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"account":{"with":{"handle":"leo"}}}}]}',
    );

    await get.accounts();
    // Make sure the email address of all resolved accounts ends with the
    // `@ronin.co` domain name.
    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"accounts":{"with":{"email":{"endingWith":"@ronin.co"}}}}}]}',
    );
  });

  test('return full query from `during` trigger', async () => {
    const { get } = createSyntaxFactory({
      triggers: {
        account: {
          get(query) {
            const fullQuery: Query = {
              get: {
                team: query,
              },
            };

            return fullQuery;
          },
        },
      },
    });

    await get.account.with.handle('elaine');

    expect(mockResolvedRequestText).toEqual(
      JSON.stringify({ queries: [{ get: { team: { with: { handle: 'elaine' } } } }] }),
    );
  });

  test('run `get` query through factory with dynamically generated config', async () => {
    const { get } = createSyntaxFactory(() => ({
      triggers: {
        account: {
          get(query, multiple) {
            if (multiple) {
              query.with = {
                email: {
                  endingWith: '@ronin.co',
                },
              };
            } else {
              query.with = {
                handle: 'leo',
              };
            }

            return query;
          },
        },
      },
    }));

    await get.account.with.handle('juri');
    // Make sure `leo` is resolved as the account handle.
    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"account":{"with":{"handle":"leo"}}}}]}',
    );

    await get.accounts();
    // Make sure the email address of all resolved accounts ends with the
    // `@ronin.co` domain name.
    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"accounts":{"with":{"email":{"endingWith":"@ronin.co"}}}}}]}',
    );
  });

  test('run `get` query through factory containing `resolving` trigger', async () => {
    const { get } = createSyntaxFactory({
      triggers: {
        schema: {
          resolvingGet(_query, multiple) {
            if (multiple)
              return [
                {
                  id: '1',
                },
                {
                  id: '2',
                },
              ];

            if (!multiple)
              return {
                id: '1',
              };
          },
        },
      },
    });

    const schema = await get.schema.with.id('1');
    // Make sure a single schema is resolved.
    expect(schema.id).toBe('1');

    const schemas = await get.schemas<Array<unknown>>();
    // Make sure multiple schemas are resolved.
    expect(schemas.length).toBe(2);

    await get.account.with.handle('juri');
    expect(mockResolvedRequestText).toEqual(
      '{"queries":[{"get":{"account":{"with":{"handle":"juri"}}}}]}',
    );
  });

  test('run `create` query through factory containing `following` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let finalBeforeResult: unknown;
    let finalAfterResult: unknown;

    const { create } = createSyntaxFactory({
      // biome-ignore lint/suspicious/useAwait: `fetch` requires a promise return.
      fetch: async () => {
        return Response.json({
          results: [
            {
              record: {
                id: '1',
                slug: 'account',
                pluralSlug: 'accounts',
                name: 'Account',
                pluralName: 'Accounts',
              },
            },
          ],
        });
      },
      triggers: {
        model: {
          followingCreate(query, multiple, beforeResult, afterResult) {
            finalQuery = query;
            finalMultiple = multiple;
            finalBeforeResult = beforeResult;
            finalAfterResult = afterResult;
          },
        },
      },
    });

    const model = await create.model({
      slug: 'account',
    } as Parameters<typeof create.model>[0]);

    // Make sure `finalQuery` matches the initial query.
    expect(finalQuery).toMatchObject({
      model: {
        slug: 'account',
      },
    });

    // Make sure `finalBeforeResult` is empty, since the record is being
    // created and didn't exist before.
    //
    // We must use `toMatchObject` here, to ensure that the array is really
    // empty and doesn't contain any `undefined` items.
    expect(finalBeforeResult).toMatchObject([]);

    // Make sure `finalAfterResult` matches the resolved account.
    expect(finalAfterResult).toEqual([model]);

    expect(finalMultiple).toBe(false);
  });

  test('run `alter` query through factory containing `after` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let finalBeforeResult: unknown;
    let finalAfterResult: unknown;

    let mockResolvedRequestJSON: unknown | undefined;

    const previousModel = {
      id: '1',
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      pluralName: 'Accounts',
    };

    const nextModel = {
      id: '1',
      slug: 'user',
      pluralSlug: 'users',
      name: 'User',
      pluralName: 'Users',
    };

    const { alter } = createSyntaxFactory({
      fetch: async (request) => {
        mockResolvedRequestJSON = await (request as Request).json();

        return Response.json({
          results: [
            {
              record: previousModel,
            },
            {
              record: nextModel,
            },
          ],
        });
      },
      triggers: {
        model: {
          followingAlter(query, multiple, beforeResult, afterResult) {
            finalQuery = query;
            finalMultiple = multiple;
            finalBeforeResult = beforeResult;
            finalAfterResult = afterResult;
          },
        },
      },
    });

    await (alter as unknown as (details: object) => unknown)({
      model: 'account',
      to: {
        slug: 'user',
      },
    });

    expect(mockResolvedRequestJSON).toEqual({
      queries: [
        { list: { model: 'account' } },
        { alter: { model: 'account', to: { slug: 'user' } } },
      ],
    });

    // Make sure `finalQuery` matches the initial query payload.
    expect(finalQuery).toMatchObject({
      model: 'account',
      to: {
        slug: 'user',
      },
    });

    // Make sure `finalBeforeResult` is empty, since the record is being
    // created and didn't exist before.
    //
    // We must use `toMatchObject` here, to ensure that the array is really
    // empty and doesn't contain any `undefined` items.
    expect(finalBeforeResult).toMatchObject([previousModel]);

    // Make sure `finalAfterResult` matches the resolved account.
    expect(finalAfterResult).toEqual([nextModel]);

    expect(finalMultiple).toBe(false);
  });

  test('run `drop` query through factory containing `after` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let finalBeforeResult: unknown;
    let finalAfterResult: unknown;

    const { drop } = createSyntaxFactory({
      // biome-ignore lint/suspicious/useAwait: `fetch` requires a promise return.
      fetch: async () => {
        return Response.json({
          results: [
            {
              record: {
                id: '1',
                slug: 'account',
                pluralSlug: 'accounts',
                name: 'Account',
                pluralName: 'Accounts',
              },
            },
          ],
        });
      },
      triggers: {
        model: {
          followingDrop(query, multiple, beforeResult, afterResult) {
            finalQuery = query;
            finalMultiple = multiple;
            finalBeforeResult = beforeResult;
            finalAfterResult = afterResult;
          },
        },
      },
    });

    const model = await drop.model('account' as Parameters<typeof drop.model>[0]);

    // Make sure `finalQuery` matches the initial query payload.
    expect(finalQuery).toMatchObject({
      model: 'account',
    });

    // Make sure `finalBeforeResult` is defined and contains the value of the record
    // before it was removed.
    expect(finalBeforeResult).toEqual([model]);

    // Make sure `finalAfterResult` is empty, since the record was removed from the DB.
    //
    // We must use `toMatchObject` here, to ensure that the array is really
    // empty and doesn't contain any `undefined` items.
    expect(finalAfterResult).toMatchObject([]);

    expect(finalMultiple).toBe(false);
  });

  test('run `remove` query through factory containing `after` trigger', async () => {
    let finalBeforeResult: unknown;
    let finalAfterResult: unknown;

    const { remove } = createSyntaxFactory({
      // biome-ignore lint/suspicious/useAwait: `fetch` requires a promise return.
      fetch: async () => {
        return Response.json({
          results: [
            {
              record: {
                id: '1',
                handle: 'juri',
                firstName: 'Juri',
                lastName: 'Adams',
              },
            },
          ],
        });
      },
      triggers: {
        account: {
          followingRemove(_query, _multiple, beforeResult, afterResult) {
            finalBeforeResult = beforeResult;
            finalAfterResult = afterResult;
          },
        },
      },
    });

    const account = await remove.account({
      with: {
        handle: 'juri',
      },
    });

    // Make sure `finalBeforeResult` is defined and contains the value of the record
    // before it was removed.
    expect(finalBeforeResult).toEqual([account]);

    // Make sure `finalAfterResult` is empty, since the record was removed from the DB.
    //
    // We must use `toMatchObject` here, to ensure that the array is really
    // empty and doesn't contain any `undefined` items.
    expect(finalAfterResult).toMatchObject([]);
  });

  test('run `set` query affecting multiple accounts through factory containing `after` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let finalBeforeResult: unknown;
    let finalAfterResult: unknown;

    const previousAccounts = [
      {
        id: '1',
        email: 'prev@ronin.co',
      },
      {
        id: '2',
        email: 'prev@ronin.co',
      },
    ];

    const nextAccounts = [
      {
        id: '1',
        email: 'test@ronin.co',
      },
      {
        id: '2',
        email: 'test@ronin.co',
      },
    ];

    const { set } = createSyntaxFactory({
      // biome-ignore lint/suspicious/useAwait: `fetch` requires a promise return.
      fetch: async () => {
        return Response.json({
          results: [{ records: previousAccounts }, { records: nextAccounts }],
        });
      },
      triggers: {
        account: {
          followingSet(query, multiple, beforeResult, afterResult) {
            finalQuery = query;
            finalMultiple = multiple;
            finalBeforeResult = beforeResult;
            finalAfterResult = afterResult;
          },
        },
      },
    });

    const accounts = (await set.accounts({
      with: {
        email: {
          endingWith: '@ronin.co',
        },
      },
      to: {
        email: 'test@ronin.co',
      },
    })) as unknown as Array<Record<string, unknown>>;

    // Make sure all accounts were updated successfully.
    expect(accounts.every(({ email }) => email === 'test@ronin.co')).toBe(true);

    // Make sure `finalQuery` matches the initial query.
    expect(finalQuery).toMatchObject({
      with: {
        email: {
          endingWith: '@ronin.co',
        },
      },
      to: {
        email: 'test@ronin.co',
      },
    });

    // Make sure `finalBeforeResult` matches the previous accounts.
    expect(finalBeforeResult).toEqual(previousAccounts);

    // Make sure `finalAfterResult` matches the resolved accounts.
    expect(finalAfterResult).toEqual(accounts);

    expect(finalMultiple).toBe(true);
  });

  test('run normal queries alongside queries that are handled by `resolving` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let mockResolvedRequestText: string | undefined;

    const { get, batch } = createSyntaxFactory({
      fetch: async (request) => {
        mockResolvedRequestText = await (request as Request).text();

        return Response.json({
          results: [
            {
              records: [{ id: 'mem_1' }, { id: 'mem_2' }],
            },
          ],
        });
      },
      triggers: {
        account: {
          resolvingGet(query, multiple) {
            finalQuery = query;
            finalMultiple = multiple;

            return { id: 'juri' };
          },
        },
      },
    });

    const result = await batch(() => [
      get.account.with({
        handle: 'juri',
        firstName: 'Juri',
        lastName: 'Adams',
      }),
      get.members(),
    ]);

    // Make sure only one request is sent to the server and the request which
    // was handled by the "resolving" "get" trigger is dropped out.
    expect(mockResolvedRequestText).toEqual('{"queries":[{"get":{"members":{}}}]}');

    expect(result.length).toBe(2);

    expect(result[0]).toMatchObject({ id: 'juri' });

    expect(result[1]).toMatchObject([{ id: 'mem_1' }, { id: 'mem_2' }]);

    expect(finalQuery).toMatchObject({
      with: {
        handle: 'juri',
        firstName: 'Juri',
        lastName: 'Adams',
      },
    });
    expect(finalMultiple).toBe(false);
  });

  test('receive options for sink trigger', async () => {
    const mockFetchNew = mock(() => {
      return Response.json({
        default: {
          results: [
            {
              record: {
                handle: 'elaine',
              },
              modelFields: {
                name: 'string',
              },
            },
          ],
        },
      });
    });

    const defaultQueries: Array<Query> = [
      {
        add: {
          account: {
            with: {
              handle: 'elaine',
            },
          },
        },
      },
    ];

    const secondaryQueries: Array<Query> = [
      {
        add: {
          // We are purposefully using camel-case here in order to ensure that the final
          // trigger options are formatted correctly.
          someProduct: {
            with: {
              name: 'MacBook Pro',
            },
          },
        },
      },
    ];

    let duringAddOptions: Parameters<AddTrigger>[2] | undefined;
    let resolvingAddOptions: Parameters<ResolvingAddTrigger>[2] | undefined;
    let followingAddOptions: Parameters<FollowingAddTrigger>[4] | undefined;

    const results = await runQueriesWithStorageAndTriggers(
      {
        default: defaultQueries,
        secondary: secondaryQueries,
      },
      {
        fetch: async () => mockFetchNew(),
        token: 'takashitoken',
        triggers: {
          sink: {
            add: (query, _multiple, options) => {
              duringAddOptions = options;
              return query;
            },
            resolvingAdd: (query, _multiple, options) => {
              resolvingAddOptions = options;
              return query.with;
            },
            followingAdd: (_query, _multiple, _beforeResult, _afterResult, options) => {
              followingAddOptions = options;
            },
          },
        },
      },
    );

    const expectedOptions = { model: 'someProduct', database: 'secondary' };

    expect(duringAddOptions).toMatchObject(expectedOptions);
    expect(resolvingAddOptions).toMatchObject(expectedOptions);
    expect(followingAddOptions).toMatchObject(expectedOptions);

    expect(results).toMatchObject({
      default: [
        {
          handle: 'elaine',
        },
      ],
      secondary: [
        {
          name: 'MacBook Pro',
        },
      ],
    });
  });

  test('return queries from `before` trigger', async () => {
    const mockFetchNew: typeof fetch = async (input: string | URL | Request) => {
      mockResolvedRequestText = await (input as Request).text();

      return Response.json({
        default: {
          results: [
            {
              record: {
                handle: 'elaine',
              },
              modelFields: {
                handle: 'string',
              },
            },
            {
              record: {
                handle: 'company',
              },
              modelFields: {
                handle: 'string',
              },
            },
            {
              record: {
                account: '1234',
                space: '1234',
                role: 'owner',
              },
              modelFields: {
                account: 'link',
                space: 'link',
                role: 'string',
              },
            },
            {
              record: {
                name: 'MacBook',
                color: 'Space Black',
              },
              modelFields: {
                name: 'string',
                color: 'string',
              },
            },
          ],
        },
      });
    };

    let accountTriggersOptions = {} as Parameters<FollowingAddTrigger>[4];
    const accountTriggers: { followingAdd: FollowingAddTrigger } = {
      followingAdd: (_query, _multiple, _before_, _after, options) => {
        accountTriggersOptions = options;
      },
    };
    const accountTriggersSpy = spyOn(accountTriggers, 'followingAdd');

    let spaceTriggersOptions = {} as Parameters<FollowingAddTrigger>[4];
    const spaceTriggers: { followingAdd: FollowingAddTrigger } = {
      followingAdd: (_query, _multiple, _before_, _after, options) => {
        spaceTriggersOptions = options;
      },
    };
    const spaceTriggersSpy = spyOn(spaceTriggers, 'followingAdd');

    const { batch, add } = createSyntaxFactory({
      triggers: {
        member: {
          beforeAdd(query) {
            const accountQuery: Query = {
              add: {
                account: {
                  with: (query.with as { account: Record<string, string> }).account,
                },
              },
            };

            const spaceQuery: Query = {
              add: {
                space: {
                  with: (query.with as { space: Record<string, string> }).space,
                },
              },
            };

            return [accountQuery, spaceQuery];
          },
        },

        account: accountTriggers,
        space: spaceTriggers,
      },
      fetch: mockFetchNew,
    });

    // We're using a batch to be able to check whether the results of the queries
    // returned from the `pre` trigger are being excluded correctly.
    const results = await batch(() => [
      add.member.with({
        account: { handle: 'elaine' },
        space: { handle: 'company' },
        role: 'owner',
      }),
      add.product.with({
        name: 'MacBook',
        color: 'Space Black',
      }),
    ]);

    expect(results).toEqual([
      {
        account: '1234',
        space: '1234',
        role: 'owner',
      },
      {
        name: 'MacBook',
        color: 'Space Black',
      },
    ]);

    expect(accountTriggersOptions).toEqual({
      implicit: true,
      client: expect.any(Object),
    });
    expect(spaceTriggersOptions).toEqual({ implicit: true, client: expect.any(Object) });

    expect(accountTriggersSpy).toHaveBeenCalled();
    expect(spaceTriggersSpy).toHaveBeenCalled();

    expect(mockResolvedRequestText).toEqual(
      JSON.stringify({
        queries: [
          { add: { account: { with: { handle: 'elaine' } } } },
          { add: { space: { with: { handle: 'company' } } } },
          {
            add: {
              member: {
                with: {
                  account: { handle: 'elaine' },
                  space: { handle: 'company' },
                  role: 'owner',
                },
              },
            },
          },
          { add: { product: { with: { name: 'MacBook', color: 'Space Black' } } } },
        ],
      }),
    );
  });

  test('return queries from `after` trigger', async () => {
    const mockFetchNew: typeof fetch = async (input: string | URL | Request) => {
      mockResolvedRequestText = await (input as Request).text();

      return Response.json({
        default: {
          results: [
            {
              record: {
                handle: 'company',
              },
              modelFields: {
                handle: 'string',
              },
            },
            {
              record: {
                space: '1234',
                role: 'owner',
              },
              modelFields: {
                space: 'link',
                role: 'string',
              },
            },
            {
              record: {
                space: '1234',
                token: '1234',
              },
              modelFields: {
                space: 'link',
                role: 'string',
              },
            },
            {
              record: {
                name: 'MacBook',
                color: 'Space Black',
              },
              modelFields: {
                name: 'string',
                color: 'string',
              },
            },
          ],
        },
      });
    };

    const memberTriggers = { followingAdd: () => undefined };
    const memberTriggersSpy = spyOn(memberTriggers, 'followingAdd');

    const appTriggers = { followingAdd: () => undefined };
    const appTriggersSpy = spyOn(appTriggers, 'followingAdd');

    const { batch, add } = createSyntaxFactory({
      triggers: {
        space: {
          afterAdd(query) {
            const memberQuery: Query = {
              add: {
                member: {
                  with: {
                    space: {
                      handle: (query.with as { handle: string }).handle,
                    },
                    role: 'owner',
                  },
                },
              },
            };

            const appQuery: Query = {
              add: {
                app: {
                  with: {
                    space: {
                      handle: (query.with as { handle: string }).handle,
                    },
                    token: '1234',
                  },
                },
              },
            };

            return [memberQuery, appQuery];
          },
        },

        member: memberTriggers,
        app: appTriggers,
      },
      fetch: mockFetchNew,
    });

    // We're using a batch to be able to check whether the results of the queries
    // returned from the `after` trigger are being excluded correctly.
    const results = await batch(() => [
      add.space.with.handle('company'),
      add.product.with({
        name: 'MacBook',
        color: 'Space Black',
      }),
    ]);

    expect(results).toEqual([
      {
        handle: 'company',
      },
      {
        name: 'MacBook',
        color: 'Space Black',
      },
    ]);

    expect(memberTriggersSpy).toHaveBeenCalled();
    expect(appTriggersSpy).toHaveBeenCalled();

    expect(mockResolvedRequestText).toEqual(
      JSON.stringify({
        queries: [
          { add: { space: { with: { handle: 'company' } } } },
          { add: { member: { with: { space: { handle: 'company' }, role: 'owner' } } } },
          { add: { app: { with: { space: { handle: 'company' }, token: '1234' } } } },
          { add: { product: { with: { name: 'MacBook', color: 'Space Black' } } } },
        ],
      }),
    );
  });

  test('run queries with triggers required for all queries', async () => {
    const { get, remove } = createSyntaxFactory({
      // biome-ignore lint/suspicious/useAwait: We need this to satisfy the types.
      fetch: async () => {
        return Response.json({ results: [] });
      },
      requireTriggers: 'all',
    });

    expect(get.accounts()).rejects.toThrow(
      'Please define "during" triggers for the provided queries.',
    );

    expect(remove.account.with.handle('elaine')).rejects.toThrow(
      'Please define "during" triggers for the provided queries.',
    );
  });

  test('run queries with triggers required for read queries', async () => {
    const { get } = createSyntaxFactory({
      // biome-ignore lint/suspicious/useAwait: We need this to satisfy the types.
      fetch: async () => {
        return Response.json({ results: [] });
      },
      requireTriggers: 'read',
      triggers: {
        team: {
          get: (query) => query,
        },
      },
    });

    expect(get.accounts()).rejects.toThrow(
      'Please define "during" triggers for the provided read queries.',
    );
  });

  test('run queries with triggers required for write queries', async () => {
    const { remove } = createSyntaxFactory({
      // biome-ignore lint/suspicious/useAwait: We need this to satisfy the types.
      fetch: async () => {
        return Response.json({ results: [] });
      },
      requireTriggers: 'write',
      triggers: {
        team: {
          get: (query) => query,
        },
      },
    });

    expect(remove.account.with.handle('elaine')).rejects.toThrow(
      'Please define "during" triggers for the provided write queries.',
    );
  });
});
