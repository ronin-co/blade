import { expect, test } from 'bun:test';
import {
  CompilerError,
  type Model,
  QUERY_SYMBOLS,
  type Query,
  Transaction,
} from '@/src/index';

import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import type { SingleRecordResult } from '@/src/types/result';

test('get single record using preset', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          using: ['specificAccount'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
      },
      presets: {
        specificAccount: {
          instructions: {
            with: {
              account: {
                being: 'acc_39h8fhe98hefah9j',
              },
            },
          },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account" FROM "members" WHERE "account" = ?1 LIMIT 1',
      params: ['acc_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    account: 'acc_39h8fhe98hefah9j',
  });
});

test('get single record using preset containing field with condition', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          using: {
            activeMember: 'acc_39h8fhe98hefah8j',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
        team: {
          type: 'link',
          target: 'team',
        },
        activeAt: {
          type: 'date',
        },
      },
    },
    {
      slug: 'product',
      fields: {
        name: {
          type: 'string',
        },
        team: {
          type: 'link',
          target: 'team',
        },
      },
      presets: {
        activeMember: {
          instructions: {
            with: {
              team: {
                being: {
                  [QUERY_SYMBOLS.QUERY]: {
                    get: {
                      member: {
                        with: { account: QUERY_SYMBOLS.VALUE },
                        orderedBy: { descending: ['activeAt'] },
                        selecting: ['team'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "team" FROM "products" WHERE "team" = (SELECT "team" FROM "members" WHERE "account" = ?1 ORDER BY "activeAt" DESC LIMIT 1) LIMIT 1',
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'pro_39h8fhe98hefah8j',
    name: 'Apple',
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    team: 'tea_39h8fhe98hefah8j',
  });
});

test('get single record using preset containing field without condition', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          using: {
            activeMember: 'acc_39h8fhe98hefah8j',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
        team: {
          type: 'link',
          target: 'team',
        },
        activeAt: {
          type: 'date',
        },
      },
    },
    {
      slug: 'product',
      fields: {
        name: {
          type: 'string',
        },
        team: {
          type: 'link',
          target: 'team',
        },
      },
      presets: {
        activeMember: {
          instructions: {
            with: {
              team: {
                [QUERY_SYMBOLS.QUERY]: {
                  get: {
                    member: {
                      with: { account: QUERY_SYMBOLS.VALUE },
                      orderedBy: { descending: ['activeAt'] },
                      selecting: ['team'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "team" FROM "products" WHERE "team" = (SELECT "team" FROM "members" WHERE "account" = ?1 ORDER BY "activeAt" DESC LIMIT 1) LIMIT 1',
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'pro_39h8fhe98hefah8j',
    name: 'Apple',
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    team: 'tea_39h8fhe98hefah8j',
  });
});

test('get single record using preset on existing object instruction', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: 'acc_39h8fhe98hefah8j',
          },
          using: ['specificTeam'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
        team: {
          type: 'link',
          target: 'team',
        },
      },
      presets: {
        specificTeam: {
          instructions: {
            with: {
              team: 'tea_39h8fhe98hefah9j',
            },
          },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account", "team" FROM "members" WHERE "team" = ?1 AND "account" = ?2 LIMIT 1',
      params: ['tea_39h8fhe98hefah9j', 'acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'mem_39h8fhe98hefah0j',
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    account: 'acc_39h8fhe98hefah8j',
    team: 'tea_39h8fhe98hefah9j',
  });
});

test('get single record using preset on existing array instruction', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          selecting: ['account'],
          using: ['selectedTeam'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
        team: {
          type: 'link',
          target: 'team',
        },
      },
      presets: {
        selectedTeam: {
          instructions: {
            selecting: ['team'],
          },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "team", "account" FROM "members" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as unknown as SingleRecordResult<{
    account: string;
    team: string;
  }>;

  expect(result.record).toEqual({
    account: 'acc_39h8fhe98hefah8j',
    team: 'tea_39h8fhe98hefah8j',
  });
});

test('get single record using preset for including all link fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: { id: 'mem_39h8fhe98hefah8j' },
          using: ['links'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
      },
    },
    {
      slug: 'team',
      fields: {
        locations: {
          type: 'json',
        },
      },
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
        team: {
          type: 'link',
          target: 'team',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "members"."id", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "members"."team", "including_team"."id" as "team.id", "including_team"."ronin.createdAt" as "team.ronin.createdAt", "including_team"."ronin.createdBy" as "team.ronin.createdBy", "including_team"."ronin.updatedAt" as "team.ronin.updatedAt", "including_team"."ronin.updatedBy" as "team.ronin.updatedBy", "including_team"."locations" as "team.locations", "including_account"."id" as "account.id", "including_account"."ronin.createdAt" as "account.ronin.createdAt", "including_account"."ronin.createdBy" as "account.ronin.createdBy", "including_account"."ronin.updatedAt" as "account.ronin.updatedAt", "including_account"."ronin.updatedBy" as "account.ronin.updatedBy", "including_account"."handle" as "account.handle" FROM "members" LEFT JOIN "teams" as "including_team" ON ("including_team"."id" = "members"."team")LEFT JOIN "accounts" as "including_account" ON ("including_account"."id" = "members"."account") WHERE "members"."id" = ?1 LIMIT 1',
      params: ['mem_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'mem_39h8fhe98hefah8j',
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    account: {
      id: 'acc_39h8fhe98hefah8j',
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      handle: 'elaine',
    },
    team: {
      id: 'tea_39h8fhe98hefah8j',
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      locations: {
        europe: 'berlin',
      },
    },
  });
});

test('get single record including parent record (many-to-one)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          using: ['account'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
          kind: 'one',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "members"."id", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "including_account"."id" as "account.id", "including_account"."ronin.createdAt" as "account.ronin.createdAt", "including_account"."ronin.createdBy" as "account.ronin.createdBy", "including_account"."ronin.updatedAt" as "account.ronin.updatedAt", "including_account"."ronin.updatedBy" as "account.ronin.updatedBy" FROM "members" LEFT JOIN "accounts" as "including_account" ON ("including_account"."id" = "members"."account") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    account: {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
    },
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
  });
});

test('get single record including child records (one-to-many, defined manually)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          using: ['visitors'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
        firstName: {
          type: 'string',
        },
      },
    },
    {
      slug: 'beach',
      fields: {
        visitors: {
          type: 'link',
          target: 'account',
          kind: 'many',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "sub_beaches"."id", "sub_beaches"."ronin.createdAt", "sub_beaches"."ronin.createdBy", "sub_beaches"."ronin.updatedAt", "sub_beaches"."ronin.updatedBy", "including_visitors[0]"."id" as "visitors[0].id", "including_visitors[0]"."ronin.createdAt" as "visitors[0].ronin.createdAt", "including_visitors[0]"."ronin.createdBy" as "visitors[0].ronin.createdBy", "including_visitors[0]"."ronin.updatedAt" as "visitors[0].ronin.updatedAt", "including_visitors[0]"."ronin.updatedBy" as "visitors[0].ronin.updatedBy", "including_visitors[0]{1}"."id" as "visitors[0]{1}.id", "including_visitors[0]{1}"."ronin.createdAt" as "visitors[0]{1}.ronin.createdAt", "including_visitors[0]{1}"."ronin.createdBy" as "visitors[0]{1}.ronin.createdBy", "including_visitors[0]{1}"."ronin.updatedAt" as "visitors[0]{1}.ronin.updatedAt", "including_visitors[0]{1}"."ronin.updatedBy" as "visitors[0]{1}.ronin.updatedBy", "including_visitors[0]{1}"."handle" as "visitors[0]{1}.handle", "including_visitors[0]{1}"."firstName" as "visitors[0]{1}.firstName" FROM (SELECT * FROM "beaches" LIMIT 1) as sub_beaches LEFT JOIN "ronin_link_beach_visitors" as "including_visitors[0]" ON ("including_visitors[0]"."source" = "sub_beaches"."id") LEFT JOIN "accounts" as "including_visitors[0]{1}" ON ("including_visitors[0]{1}"."id" = "including_visitors[0]"."target")`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    visitors: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      handle: expect.any(String),
      firstName: expect.any(String),
    }),
  });
});

test('get single record including child records (one-to-many, defined manually, multiple fields)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          using: ['visitors', 'volleyballTeams'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
        firstName: {
          type: 'string',
        },
      },
    },
    {
      slug: 'team',
      fields: {
        locations: {
          type: 'json',
        },
      },
    },
    {
      slug: 'beach',
      fields: {
        visitors: {
          type: 'link',
          target: 'account',
          kind: 'many',
        },
        volleyballTeams: {
          type: 'link',
          target: 'team',
          kind: 'many',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "sub_beaches"."id", "sub_beaches"."ronin.createdAt", "sub_beaches"."ronin.createdBy", "sub_beaches"."ronin.updatedAt", "sub_beaches"."ronin.updatedBy", "including_volleyballTeams[0]"."id" as "volleyballTeams[0].id", "including_volleyballTeams[0]"."ronin.createdAt" as "volleyballTeams[0].ronin.createdAt", "including_volleyballTeams[0]"."ronin.createdBy" as "volleyballTeams[0].ronin.createdBy", "including_volleyballTeams[0]"."ronin.updatedAt" as "volleyballTeams[0].ronin.updatedAt", "including_volleyballTeams[0]"."ronin.updatedBy" as "volleyballTeams[0].ronin.updatedBy", "including_volleyballTeams[0]{1}"."id" as "volleyballTeams[0]{1}.id", "including_volleyballTeams[0]{1}"."ronin.createdAt" as "volleyballTeams[0]{1}.ronin.createdAt", "including_volleyballTeams[0]{1}"."ronin.createdBy" as "volleyballTeams[0]{1}.ronin.createdBy", "including_volleyballTeams[0]{1}"."ronin.updatedAt" as "volleyballTeams[0]{1}.ronin.updatedAt", "including_volleyballTeams[0]{1}"."ronin.updatedBy" as "volleyballTeams[0]{1}.ronin.updatedBy", "including_volleyballTeams[0]{1}"."locations" as "volleyballTeams[0]{1}.locations", "including_visitors[0]"."id" as "visitors[0].id", "including_visitors[0]"."ronin.createdAt" as "visitors[0].ronin.createdAt", "including_visitors[0]"."ronin.createdBy" as "visitors[0].ronin.createdBy", "including_visitors[0]"."ronin.updatedAt" as "visitors[0].ronin.updatedAt", "including_visitors[0]"."ronin.updatedBy" as "visitors[0].ronin.updatedBy", "including_visitors[0]{1}"."id" as "visitors[0]{1}.id", "including_visitors[0]{1}"."ronin.createdAt" as "visitors[0]{1}.ronin.createdAt", "including_visitors[0]{1}"."ronin.createdBy" as "visitors[0]{1}.ronin.createdBy", "including_visitors[0]{1}"."ronin.updatedAt" as "visitors[0]{1}.ronin.updatedAt", "including_visitors[0]{1}"."ronin.updatedBy" as "visitors[0]{1}.ronin.updatedBy", "including_visitors[0]{1}"."handle" as "visitors[0]{1}.handle", "including_visitors[0]{1}"."firstName" as "visitors[0]{1}.firstName" FROM (SELECT * FROM "beaches" LIMIT 1) as sub_beaches LEFT JOIN "ronin_link_beach_volleyball_teams" as "including_volleyballTeams[0]" ON ("including_volleyballTeams[0]"."source" = "sub_beaches"."id") LEFT JOIN "teams" as "including_volleyballTeams[0]{1}" ON ("including_volleyballTeams[0]{1}"."id" = "including_volleyballTeams[0]"."target")LEFT JOIN "ronin_link_beach_visitors" as "including_visitors[0]" ON ("including_visitors[0]"."source" = "sub_beaches"."id") LEFT JOIN "accounts" as "including_visitors[0]{1}" ON ("including_visitors[0]{1}"."id" = "including_visitors[0]"."target")`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    visitors: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      handle: expect.any(String),
      firstName: expect.any(String),
    }),
    volleyballTeams: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      locations: {
        europe: expect.any(String),
      },
    }),
  });
});

test('get single record including child records that are partially not found (one-to-many, defined manually, multiple fields)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          using: ['visitors', 'soccerTeams'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
        firstName: {
          type: 'string',
        },
      },
    },
    {
      slug: 'team',
      fields: {
        locations: {
          type: 'json',
        },
      },
    },
    {
      slug: 'beach',
      fields: {
        visitors: {
          type: 'link',
          target: 'account',
          kind: 'many',
        },
        soccerTeams: {
          type: 'link',
          target: 'team',
          kind: 'many',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "sub_beaches"."id", "sub_beaches"."ronin.createdAt", "sub_beaches"."ronin.createdBy", "sub_beaches"."ronin.updatedAt", "sub_beaches"."ronin.updatedBy", "including_soccerTeams[0]"."id" as "soccerTeams[0].id", "including_soccerTeams[0]"."ronin.createdAt" as "soccerTeams[0].ronin.createdAt", "including_soccerTeams[0]"."ronin.createdBy" as "soccerTeams[0].ronin.createdBy", "including_soccerTeams[0]"."ronin.updatedAt" as "soccerTeams[0].ronin.updatedAt", "including_soccerTeams[0]"."ronin.updatedBy" as "soccerTeams[0].ronin.updatedBy", "including_soccerTeams[0]{1}"."id" as "soccerTeams[0]{1}.id", "including_soccerTeams[0]{1}"."ronin.createdAt" as "soccerTeams[0]{1}.ronin.createdAt", "including_soccerTeams[0]{1}"."ronin.createdBy" as "soccerTeams[0]{1}.ronin.createdBy", "including_soccerTeams[0]{1}"."ronin.updatedAt" as "soccerTeams[0]{1}.ronin.updatedAt", "including_soccerTeams[0]{1}"."ronin.updatedBy" as "soccerTeams[0]{1}.ronin.updatedBy", "including_soccerTeams[0]{1}"."locations" as "soccerTeams[0]{1}.locations", "including_visitors[0]"."id" as "visitors[0].id", "including_visitors[0]"."ronin.createdAt" as "visitors[0].ronin.createdAt", "including_visitors[0]"."ronin.createdBy" as "visitors[0].ronin.createdBy", "including_visitors[0]"."ronin.updatedAt" as "visitors[0].ronin.updatedAt", "including_visitors[0]"."ronin.updatedBy" as "visitors[0].ronin.updatedBy", "including_visitors[0]{1}"."id" as "visitors[0]{1}.id", "including_visitors[0]{1}"."ronin.createdAt" as "visitors[0]{1}.ronin.createdAt", "including_visitors[0]{1}"."ronin.createdBy" as "visitors[0]{1}.ronin.createdBy", "including_visitors[0]{1}"."ronin.updatedAt" as "visitors[0]{1}.ronin.updatedAt", "including_visitors[0]{1}"."ronin.updatedBy" as "visitors[0]{1}.ronin.updatedBy", "including_visitors[0]{1}"."handle" as "visitors[0]{1}.handle", "including_visitors[0]{1}"."firstName" as "visitors[0]{1}.firstName" FROM (SELECT * FROM "beaches" LIMIT 1) as sub_beaches LEFT JOIN "ronin_link_beach_soccer_teams" as "including_soccerTeams[0]" ON ("including_soccerTeams[0]"."source" = "sub_beaches"."id") LEFT JOIN "teams" as "including_soccerTeams[0]{1}" ON ("including_soccerTeams[0]{1}"."id" = "including_soccerTeams[0]"."target")LEFT JOIN "ronin_link_beach_visitors" as "including_visitors[0]" ON ("including_visitors[0]"."source" = "sub_beaches"."id") LEFT JOIN "accounts" as "including_visitors[0]{1}" ON ("including_visitors[0]{1}"."id" = "including_visitors[0]"."target")`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    visitors: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      handle: expect.any(String),
      firstName: expect.any(String),
    }),
    soccerTeams: [],
  });
});

test('get single record including child records (one-to-many, defined automatically)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: { handle: 'elaine' },
          using: ['members'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
      },
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "sub_accounts"."id", "sub_accounts"."ronin.createdAt", "sub_accounts"."ronin.createdBy", "sub_accounts"."ronin.updatedAt", "sub_accounts"."ronin.updatedBy", "sub_accounts"."handle", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account" FROM (SELECT * FROM "accounts" WHERE "handle" = ?1 LIMIT 1) as sub_accounts LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "sub_accounts"."id")`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'acc_39h8fhe98hefah8j',
    handle: 'elaine',
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    members: [
      {
        id: 'mem_39h8fhe98hefah8j',
        account: 'acc_39h8fhe98hefah8j',
        ronin: {
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
      {
        id: 'mem_39h8fhe98hefah0j',
        account: 'acc_39h8fhe98hefah8j',
        ronin: {
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
    ],
  });
});

test('try get single record with non-existing preset', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          using: {
            activeMember: 'acc_39h8fhe98hefah8j',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'member',
    },
  ];

  let error: Error | undefined;

  try {
    new Transaction(queries, { models });
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(CompilerError);
  expect(error).toHaveProperty(
    'message',
    'Preset "activeMember" does not exist in model "Account".',
  );
  expect(error).toHaveProperty('code', 'PRESET_NOT_FOUND');
});
