import { expect, test } from 'bun:test';
import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import {
  type Model,
  type ModelField,
  QUERY_SYMBOLS,
  type Query,
  Transaction,
} from '@/src/index';
import { getSystemFields } from '@/src/model';
import type { MultipleRecordResult, SingleRecordResult } from '@/src/types/result';
import { omit } from '@/src/utils/helpers';

test('inline statement parameters', async () => {
  const queries: Array<Query> = [
    {
      add: {
        account: {
          with: {
            handle: 'elaine',
            emails: ['test@site.co', 'elaine@site.com'],
          },
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
        emails: {
          type: 'json',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `INSERT INTO "accounts" ("handle", "emails") VALUES ('elaine', '["test@site.co","elaine@site.com"]') RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "emails"`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    handle: 'elaine',
    emails: ['test@site.co', 'elaine@site.com'],
  });
});

test('inline statement parameters when creating model', async () => {
  const newField: Partial<ModelField> = {
    name: 'Active At',
    type: 'date' as const,
    defaultValue: {
      // Assert whether inline expressions are formatted correctly.
      [QUERY_SYMBOLS.EXPRESSION]: `strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'`,
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        model: {
          slug: 'account',
          fields: { activeAt: newField },
          // Ensure that the ID in the asserted output stays stable.
          id: 'mod_1f052f8432bc861b',
        },
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY DEFAULT ('acc_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "activeAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'))`,
      params: [],
    },
    {
      sql: `INSERT INTO "ronin_schema" ("slug", "fields", "id", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug") VALUES ('account', '{"id":{"name":"ID","type":"string","defaultValue":{"__RONIN_EXPRESSION":"''acc_'' || lower(substr(hex(randomblob(12)), 1, 16))"},"system":true},"ronin.createdAt":{"name":"RONIN - Created At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"},"system":true},"ronin.createdBy":{"name":"RONIN - Created By","type":"string","system":true},"ronin.updatedAt":{"name":"RONIN - Updated At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"},"system":true},"ronin.updatedBy":{"name":"RONIN - Updated By","type":"string","system":true},"activeAt":{"name":"Active At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"}}}', 'mod_1f052f8432bc861b', 'accounts', 'Account', 'Accounts', 'acc', 'accounts', 'id', 'id') RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toHaveProperty('fields', {
    ...getSystemFields('acc'),
    activeAt: newField,
  });
});

test('inline statement parameters when creating model entity', async () => {
  const newField: ModelField = {
    slug: 'activeAt',
    name: 'Active At',
    type: 'date',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          field: newField,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `ALTER TABLE "accounts" ADD COLUMN "activeAt" DATETIME`,
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_insert("fields", '$.activeAt', json('{"name":"Active At","type":"date"}')), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = 'account' RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toHaveProperty('fields', {
    ...getSystemFields('acc'),
    activeAt: omit(newField, ['slug']),
  });
});

test('inline statement parameters containing boolean', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            pending: false,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'member',
      fields: {
        pending: {
          type: 'boolean',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "pending" FROM "members" WHERE "pending" = 0 LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    pending: false,
  });
});

test('inline default values', async () => {
  const queries: Array<Query> = [
    {
      add: {
        account: {
          with: {
            handle: 'elaine',
            emails: ['test@site.co', 'elaine@site.com'],
          },
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
        emails: {
          type: 'json',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineDefaults: true,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `INSERT INTO "accounts" ("handle", "emails", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4, ?5) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "emails"`,
      params: [
        'elaine',
        '["test@site.co","elaine@site.com"]',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    handle: 'elaine',
    emails: ['test@site.co', 'elaine@site.com'],
  });
});

// Ensure that default fields are not repeated if they are already present.
test('provide models containing default fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: 'elaine',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        ...getSystemFields('acc'),
        handle: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" WHERE "handle" = 'elaine' LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    handle: 'elaine',
  });
});

// Ensure that default presets are not repeated if they are already present.
test('provide models containing default presets', async () => {
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
      presets: {
        account: {
          instructions: {
            with: {
              account: {
                handle: 'elaine',
              },
            },
          },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account" FROM "members" WHERE "account" = (SELECT "id" FROM "accounts" WHERE "handle" = 'elaine' LIMIT 1) LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    account: 'acc_39h8fhe98hefah8j',
  });
});

test('limit amount of records', async () => {
  const queries: Array<Query> = [
    {
      get: {
        products: null,
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'product',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    defaultRecordLimit: 2,
  });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "products" ORDER BY "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  // Assert the amount of records.
  expect(result.records).toHaveLength(3);

  // Assert that records are ordered by creation date.
  expect(
    result.records
      .map((i) => new Date(i.ronin.createdAt).getTime())
      .every((t, i, arr) => i === 0 || arr[i - 1] >= t),
  ).toBe(true);
});
