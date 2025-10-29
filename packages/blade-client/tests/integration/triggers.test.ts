import { describe, expect, mock, spyOn, test } from 'bun:test';
import type { CombinedInstructions, Query, QueryType, Statement } from 'blade-compiler';

import { createSyntaxFactory } from '@/src/index';
import { runQueriesWithStorageAndTriggers } from '@/src/queries';
import {
  type FilteredTriggerQuery,
  type Trigger,
  type Triggers,
  runQueriesWithTriggers,
} from '@/src/triggers';

describe('triggers', () => {
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
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      triggers: {
        account: {
          get({ query, multipleRecords }) {
            if (multipleRecords) {
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
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'account',
          fields: { handle: { type: 'string' }, email: { type: 'string' } },
        },
      ],
    });

    await factory.get.account.with.handle('juri');
    // Make sure `leo` is resolved as the account handle.
    expect(mockStatements?.[0]).toMatchObject({
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "email" FROM "accounts" WHERE "handle" = ?1 LIMIT 1',
      params: ['leo'],
    });

    await factory.get.accounts();
    // Make sure the email address of all resolved accounts ends with the
    // `@ronin.co` domain name.
    expect(mockStatements?.[0]).toMatchObject({
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "email" FROM "accounts" WHERE "email" LIKE ?1',
      params: ['%@ronin.co'],
    });
  });

  test('return full query from `during` trigger', async () => {
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      triggers: {
        account: {
          get({ query }) {
            const fullQuery: Query = {
              get: {
                team: query,
              },
            };

            return fullQuery;
          },
        },
      },
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        { slug: 'account', fields: { handle: { type: 'string' } } },
        { slug: 'team', fields: { handle: { type: 'string' } } },
      ],
    });

    await factory.get.account.with.handle('elaine');

    expect(mockStatements?.[0]).toMatchObject({
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "teams" WHERE "handle" = ?1 LIMIT 1',
      params: ['elaine'],
    });
  });

  test('run `get` query through factory with dynamically generated config', async () => {
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory(() => ({
      triggers: {
        account: {
          get({ query, multipleRecords }) {
            if (multipleRecords) {
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
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'account',
          fields: { handle: { type: 'string' }, email: { type: 'string' } },
        },
      ],
    }));

    await factory.get.account.with.handle('juri');

    // Make sure `leo` is resolved as the account handle.
    expect(mockStatements?.[0]).toMatchObject({
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "email" FROM "accounts" WHERE "handle" = ?1 LIMIT 1',
      params: ['leo'],
    });

    await factory.get.accounts.with({
      email: { endingWith: '@ronin.co' },
    });

    // Make sure the email address of all resolved accounts ends with the
    // `@ronin.co` domain name.
    expect(mockStatements?.[0]).toMatchObject({
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "email" FROM "accounts" WHERE "email" LIKE ?1',
      params: ['%@ronin.co'],
    });
  });

  test('run `get` query through factory containing `resolving` trigger', async () => {
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      triggers: {
        schema: {
          resolvingGet({ multipleRecords }) {
            if (multipleRecords)
              return [
                {
                  id: '1',
                },
                {
                  id: '2',
                },
              ];

            if (!multipleRecords)
              return {
                id: '1',
              };
          },
        },
      },
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        { slug: 'schema' },
        { slug: 'account', fields: { handle: { type: 'string' } } },
      ],
    });

    const schema = await factory.get.schema.with.id('1');
    // Make sure a single schema is resolved.
    expect(schema.id).toBe('1');

    const schemas = await factory.get.schemas<Array<unknown>>();
    // Make sure multiple schemas are resolved.
    expect(schemas.length).toBe(2);

    await factory.get.account.with.handle('juri');
    expect(mockStatements?.[0]).toMatchObject({
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" WHERE "handle" = ?1 LIMIT 1',
      params: ['juri'],
    });
  });

  test('run `create` query through factory containing `following` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let finalBeforeResult: unknown;
    let finalAfterResult: unknown;

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        console.log(statements);
        return {
          results: [
            [],
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                name: 'Account',
                pluralName: 'Accounts',
                slug: 'account',
                pluralSlug: 'accounts',
                idPrefix: null,
                table: null,
                'identifiers.name': 'id',
                'identifiers.slug': 'id',
                fields: '{}',
                indexes: '{}',
                presets: '{}',
              },
            ],
          ],
        };
      },
      triggers: {
        model: {
          followingCreate({ query, multipleRecords, previousRecords, records }) {
            finalQuery = query;
            finalMultiple = multipleRecords;
            finalBeforeResult = previousRecords;
            finalAfterResult = records;
          },
        },
      },
    });

    const model = await factory.create.model({
      slug: 'account',
    } as Parameters<typeof factory.create.model>[0]);

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

    const previousModel = {
      id: '1',
      'ronin.createdAt': '2024-04-16T15:02:12.710Z',
      'ronin.createdBy': '1234',
      'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
      'ronin.updatedBy': '1234',
      name: 'Account',
      pluralName: 'Accounts',
      slug: 'account',
      pluralSlug: 'accounts',
      idPrefix: null,
      table: null,
      'identifiers.name': 'id',
      'identifiers.slug': 'id',
      fields: '{}',
      indexes: '{}',
      presets: '{}',
    };

    const nextModel = {
      id: '1',
      'ronin.createdAt': '2024-04-16T15:02:12.710Z',
      'ronin.createdBy': '1234',
      'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
      'ronin.updatedBy': '1234',
      name: 'User',
      pluralName: 'Users',
      slug: 'user',
      pluralSlug: 'users',
      idPrefix: null,
      table: null,
      'identifiers.name': 'id',
      'identifiers.slug': 'id',
      fields: '{}',
      indexes: '{}',
      presets: '{}',
    };

    const factory = createSyntaxFactory({
      databaseCaller: () => ({
        results: [[previousModel], [], [nextModel]],
      }),
      models: [{ slug: 'account' }],
      triggers: {
        model: {
          followingAlter({ query, multipleRecords, previousRecords, records }) {
            finalQuery = query;
            finalMultiple = multipleRecords;
            finalBeforeResult = previousRecords;
            finalAfterResult = records;
          },
        },
      },
    });

    await (factory.alter as unknown as (details: object) => unknown)({
      model: 'account',
      to: {
        slug: 'user',
      },
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
    expect(finalBeforeResult).toMatchObject([
      {
        slug: 'account',
        name: 'Account',
      },
    ]);

    // Make sure `finalAfterResult` matches the resolved account.
    expect(finalAfterResult).toMatchObject([
      {
        slug: 'user',
        name: 'User',
      },
    ]);

    expect(finalMultiple).toBe(false);
  });

  test('run `drop` query through factory containing `after` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let finalBeforeResult: unknown;
    let finalAfterResult: unknown;

    const factory = createSyntaxFactory({
      databaseCaller: () => ({
        results: [
          [],
          [
            {
              id: '1',
              'ronin.createdAt': '2024-04-16T15:02:12.710Z',
              'ronin.createdBy': '1234',
              'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
              'ronin.updatedBy': '1234',
              name: 'Account',
              pluralName: 'Accounts',
              slug: 'account',
              pluralSlug: 'accounts',
              idPrefix: null,
              table: null,
              'identifiers.name': 'id',
              'identifiers.slug': 'id',
              fields: '{}',
              indexes: '{}',
              presets: '{}',
            },
          ],
        ],
      }),
      triggers: {
        model: {
          followingDrop({ query, multipleRecords, previousRecords, records }) {
            finalQuery = query;
            finalMultiple = multipleRecords;
            finalBeforeResult = previousRecords;
            finalAfterResult = records;
          },
        },
      },
      models: [{ slug: 'account' }],
    });

    const model = await factory.drop.model(
      'account' as Parameters<typeof factory.drop.model>[0],
    );

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
      databaseCaller: () => ({
        results: [
          [
            {
              id: '1',
              'ronin.createdAt': '2024-04-16T15:02:12.710Z',
              'ronin.createdBy': '1234',
              'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
              'ronin.updatedBy': '1234',
              handle: 'juri',
              firstName: 'Juri',
              lastName: 'Adams',
            },
          ],
        ],
      }),
      models: [
        {
          slug: 'account',
          fields: { handle: { type: 'string' } },
        },
      ],
      triggers: {
        account: {
          followingRemove({ previousRecords, records }) {
            finalBeforeResult = previousRecords;
            finalAfterResult = records;
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
    let finalBeforeResult: Array<Record<string, unknown>> | undefined;
    let finalAfterResult: Array<Record<string, unknown>> | undefined;

    const previousAccounts = [
      {
        id: '1',
        'ronin.createdAt': '2024-04-16T15:02:12.710Z',
        'ronin.createdBy': '1234',
        'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
        'ronin.updatedBy': '1234',
        email: 'prev@ronin.co',
      },
      {
        id: '2',
        'ronin.createdAt': '2024-04-16T15:02:12.710Z',
        'ronin.createdBy': '1234',
        'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
        'ronin.updatedBy': '1234',
        email: 'prev@ronin.co',
      },
    ];

    const nextAccounts = previousAccounts.map((account) => ({
      ...account,
      email: 'test@ronin.co',
    }));

    const { set } = createSyntaxFactory({
      databaseCaller: () => ({
        results: [previousAccounts, nextAccounts],
      }),
      models: [
        {
          slug: 'account',
          fields: { email: { type: 'string' } },
        },
      ],
      triggers: {
        account: {
          followingSet({ query, multipleRecords, previousRecords, records }) {
            finalQuery = query;
            finalMultiple = multipleRecords;
            finalBeforeResult = previousRecords as
              | Array<Record<string, unknown>>
              | undefined;
            finalAfterResult = records as Array<Record<string, unknown>> | undefined;
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
    expect(finalBeforeResult?.[0].id).toEqual(previousAccounts[0].id);
    expect(finalBeforeResult?.[0].email).toEqual(previousAccounts[0].email);

    // Make sure `finalAfterResult` matches the resolved accounts.
    expect(finalAfterResult?.[0].id).toEqual(nextAccounts[0].id);
    expect(finalAfterResult?.[0].email).toEqual(nextAccounts[0].email);

    expect(finalMultiple).toBe(true);
  });

  test('run normal queries alongside queries that are handled by `resolving` trigger', async () => {
    let finalQuery: FilteredTriggerQuery<QueryType> | undefined;
    let finalMultiple: boolean | undefined;
    let mockStatements: Array<Statement> | undefined;

    const { get, batch } = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements = statements;
        return {
          results: [[{ id: 'mem_1' }, { id: 'mem_2' }]],
        };
      },
      models: [{ slug: 'member' }],
      triggers: {
        account: {
          resolvingGet({ query, multipleRecords }) {
            finalQuery = query;
            finalMultiple = multipleRecords;

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

    // Make sure only one query is executed and the query which was handled by the
    // "resolving" "get" trigger is dropped out.
    expect(mockStatements).toHaveLength(1);

    expect(result).toHaveLength(2);

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

    let duringAddOptions: Parameters<Trigger<'during', 'add'>>[0] | undefined;
    let resolvingAddOptions:
      | Parameters<Trigger<'resolving', 'add', unknown>>[0]
      | undefined;
    let followingAddOptions:
      | Parameters<Trigger<'following', 'add', unknown>>[0]
      | undefined;

    const results = await runQueriesWithStorageAndTriggers(
      {
        default: defaultQueries,
        secondary: secondaryQueries,
      },
      {
        databaseCaller: () => ({
          results: [
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                handle: 'elaine',
              },
            ],
          ],
        }),
        triggers: {
          sink: {
            add: (options) => {
              duringAddOptions = options;
              return options.query;
            },
            resolvingAdd: (options) => {
              resolvingAddOptions = options;
              return options.query.with;
            },
            followingAdd: (options) => {
              followingAddOptions = options;
            },
          },
        },
        models: [{ slug: 'account', fields: { handle: { type: 'string' } } }],
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
    let mockStatements: Array<Statement> | undefined;

    let accountTriggersOptions = {} as Parameters<
      Trigger<'following', 'add', unknown>
    >[0];
    const accountTriggers: Triggers<'add'> = {
      followingAdd: (options) => {
        accountTriggersOptions = options;
      },
    };
    const accountTriggersSpy = spyOn(accountTriggers, 'followingAdd');

    let spaceTriggersOptions = {} as Parameters<Trigger<'following', 'add', unknown>>[0];
    const spaceTriggers: Triggers<'add'> = {
      followingAdd: (options) => {
        spaceTriggersOptions = options;
      },
    };
    const spaceTriggersSpy = spyOn(spaceTriggers, 'followingAdd');

    const factory = createSyntaxFactory({
      triggers: {
        member: {
          beforeAdd({ query }) {
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

      databaseCaller: (statements) => {
        mockStatements = statements;

        return {
          results: [
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                handle: 'elaine',
              },
            ],
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                handle: 'company',
              },
            ],
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                account: '1234',
                space: '1234',
                role: 'owner',
              },
            ],
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                name: 'MacBook',
                color: 'Space Black',
              },
            ],
          ],
        };
      },

      models: [
        {
          slug: 'account',
          fields: {
            handle: { type: 'string' },
          },
        },
        {
          slug: 'space',
          fields: {
            handle: { type: 'string' },
          },
        },
        {
          slug: 'member',
          fields: {
            account: { type: 'link', target: 'account' },
            space: { type: 'link', target: 'space' },
            role: { type: 'string' },
          },
        },
        {
          slug: 'product',
          fields: {
            name: { type: 'string' },
            color: { type: 'string' },
          },
        },
      ],
    });

    // We're using a batch to be able to check whether the results of the queries
    // returned from the `pre` trigger are being excluded correctly.
    const results = await factory.batch(() => [
      factory.add.member.with({
        account: { handle: 'elaine' },
        space: { handle: 'company' },
        role: 'owner',
      }),
      factory.add.product.with({
        name: 'MacBook',
        color: 'Space Black',
      }),
    ]);

    expect(results).toMatchObject([
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

    expect(accountTriggersOptions).toMatchObject({
      parentTrigger: { model: 'member', type: 'before' },
      client: expect.any(Object),
      context: expect.any(Map),
    });
    expect(spaceTriggersOptions).toMatchObject({
      parentTrigger: { model: 'member', type: 'before' },
      client: expect.any(Object),
      context: expect.any(Map),
    });

    expect(accountTriggersSpy).toHaveBeenCalled();
    expect(spaceTriggersSpy).toHaveBeenCalled();

    expect(mockStatements).toMatchObject([
      {
        sql: 'INSERT INTO "accounts" ("handle", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"',
        params: ['elaine', expect.any(String), expect.any(String), expect.any(String)],
        returning: true,
      },
      {
        sql: 'INSERT INTO "spaces" ("handle", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"',
        params: ['company', expect.any(String), expect.any(String), expect.any(String)],
        returning: true,
      },
      {
        sql: 'INSERT INTO "members" ("account", "space", "role", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1), (SELECT "id" FROM "spaces" WHERE "handle" = ?2 LIMIT 1), ?3, ?4, ?5, ?6) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account", "space", "role"',
        params: [
          'elaine',
          'company',
          'owner',
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ],
        returning: true,
      },
      {
        sql: 'INSERT INTO "products" ("name", "color", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4, ?5) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "color"',
        params: [
          'MacBook',
          'Space Black',
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ],
        returning: true,
      },
    ]);
  });

  test('return queries from `after` trigger', async () => {
    let mockStatements: Array<Statement> | undefined;

    const memberTriggers = { followingAdd: () => undefined };
    const memberTriggersSpy = spyOn(memberTriggers, 'followingAdd');

    const appTriggers = { followingAdd: () => undefined };
    const appTriggersSpy = spyOn(appTriggers, 'followingAdd');

    const factory = createSyntaxFactory({
      triggers: {
        space: {
          afterAdd({ query }) {
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
      databaseCaller: (statements) => {
        mockStatements = statements;

        return {
          results: [
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                handle: 'company',
              },
            ],
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                space: '1234',
                role: 'owner',
              },
            ],
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                space: '1234',
                token: '1234',
              },
            ],
            [
              {
                id: '1',
                'ronin.createdAt': '2024-04-16T15:02:12.710Z',
                'ronin.createdBy': '1234',
                'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
                'ronin.updatedBy': '1234',
                name: 'MacBook',
                color: 'Space Black',
              },
            ],
          ],
        };
      },

      models: [
        { slug: 'space', fields: { handle: { type: 'string' } } },
        {
          slug: 'member',
          fields: { space: { type: 'link', target: 'space' }, role: { type: 'string' } },
        },
        {
          slug: 'app',
          fields: { space: { type: 'link', target: 'space' }, token: { type: 'string' } },
        },
        {
          slug: 'product',
          fields: { name: { type: 'string' }, color: { type: 'string' } },
        },
      ],
    });

    // We're using a batch to be able to check whether the results of the queries
    // returned from the `after` trigger are being excluded correctly.
    const results = await factory.batch(() => [
      factory.add.space.with.handle('company'),
      factory.add.product.with({
        name: 'MacBook',
        color: 'Space Black',
      }),
    ]);

    expect(results).toMatchObject([
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

    expect(mockStatements).toMatchObject([
      {
        sql: 'INSERT INTO "spaces" ("handle", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"',
        params: ['company', expect.any(String), expect.any(String), expect.any(String)],
      },
      {
        sql: 'INSERT INTO "members" ("space", "role", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "spaces" WHERE "handle" = ?1 LIMIT 1), ?2, ?3, ?4, ?5) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "space", "role"',
        params: [
          'company',
          'owner',
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ],
      },
      {
        sql: 'INSERT INTO "apps" ("space", "token", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "spaces" WHERE "handle" = ?1 LIMIT 1), ?2, ?3, ?4, ?5) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "space", "token"',
        params: [
          'company',
          '1234',
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ],
      },
      {
        sql: 'INSERT INTO "products" ("name", "color", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4, ?5) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "color"',
        params: [
          'MacBook',
          'Space Black',
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ],
      },
    ]);
  });
});
