import { expect, test } from 'bun:test';

import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import {
  CompilerError,
  type Model,
  type ModelField,
  type ModelIndex,
  type ModelPreset,
  QUERY_SYMBOLS,
  type Query,
  ROOT_MODEL,
  Transaction,
} from '@/src/index';
import { getSystemFields } from '@/src/model';
import { slugToName } from '@/src/model/defaults';
import type { MultipleRecordResult, SingleRecordResult } from '@/src/types/result';
import { omit } from '@/src/utils/helpers';

test('create new model', () => {
  const fields: Model['fields'] = {
    handle: {
      type: 'string',
    },
    email: {
      type: 'string',
      required: true,
      unique: true,
      check: {
        [QUERY_SYMBOLS.EXPRESSION]: `length(${QUERY_SYMBOLS.FIELD}handle) >= 3`,
      },
      collation: 'NOCASE',
    },
    position: {
      type: 'number',
      increment: true,
    },
    name: {
      type: 'string',
      computedAs: {
        kind: 'STORED',
        value: {
          [QUERY_SYMBOLS.EXPRESSION]: `UPPER(substr(${QUERY_SYMBOLS.FIELD}handle, 1, 1)) || substr(${QUERY_SYMBOLS.FIELD}handle, 2)`,
        },
      },
    },
  };

  const indexes: Model['indexes'] = {
    indexSlug: {
      fields: [
        {
          slug: 'handle',
        },
      ],
      unique: true,
    },
  };

  const presets: Model['presets'] = {
    companyEmployees: {
      instructions: {
        with: {
          email: {
            endingWith: '@company.co',
          },
        },
      },
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        model: { slug: 'account', fields, indexes, presets },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'signup',
      fields: {
        year: { type: 'number' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY DEFAULT ('acc_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "handle" TEXT, "email" TEXT UNIQUE NOT NULL COLLATE NOCASE CHECK (length("handle") >= 3), "position" INTEGER AUTOINCREMENT, "name" TEXT GENERATED ALWAYS AS (UPPER(substr("handle", 1, 1)) || substr("handle", 2)) STORED)`,
      params: [],
    },
    {
      params: [],
      sql: 'CREATE UNIQUE INDEX "index_slug" ON "accounts" ("handle")',
    },
    {
      sql: 'INSERT INTO "ronin_schema" ("slug", "fields", "indexes", "presets", "id", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug") VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"',
      params: [
        'account',
        JSON.stringify({
          ...getSystemFields('acc'),
          ...Object.fromEntries(
            Object.entries(fields).map(([fieldSlug, rest]) => [
              fieldSlug,
              { ...rest, name: slugToName(fieldSlug) },
            ]),
          ),
        }),
        JSON.stringify(indexes),
        JSON.stringify(presets),
        expect.stringMatching(RECORD_ID_REGEX),
        'accounts',
        'Account',
        'Accounts',
        'acc',
        'accounts',
        'id',
        'id',
      ],
      returning: true,
    },
  ]);
});

// Ensure that a reasonable display name and URL slug are automatically selected for the
// model, based on which fields are available.
test('create new model with suitable default identifiers', () => {
  const fields: Model['fields'] = {
    name: {
      type: 'string',
      required: true,
    },
    handle: {
      type: 'string',
      required: true,
      unique: true,
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        model: { slug: 'account', fields },
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements[1].params[8]).toEqual('name');
  expect(transaction.statements[1].params[9]).toEqual('handle');
});

test('create new model with lowercased id prefix', () => {
  const queries: Array<Query> = [
    {
      create: {
        model: { slug: 'myPaintings' },
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements[1].params[5]).toBe('myp');
});

// Assert whether the system models associated with the model are correctly created.
test('create new model that has system models associated with it', () => {
  const fields: Model['fields'] = {
    followers: {
      type: 'link',
      target: 'account',
      kind: 'many',
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        model: { slug: 'account', fields },
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements[1]).toEqual({
    sql: `CREATE TABLE "ronin_link_account_followers" ("id" TEXT PRIMARY KEY DEFAULT ('ron_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "source" TEXT REFERENCES accounts("id") ON DELETE CASCADE ON UPDATE CASCADE, "target" TEXT REFERENCES accounts("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
    params: [],
  });
});

test('create new model that references itself', () => {
  const fields: Model['fields'] = {
    parentTeam: {
      type: 'link',
      target: 'team',
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        model: { slug: 'team', fields },
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements[0]).toEqual({
    sql: `CREATE TABLE "teams" ("id" TEXT PRIMARY KEY DEFAULT ('tea_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "parentTeam" TEXT REFERENCES teams("id"))`,
    params: [],
  });
});

test('list existing models', async () => {
  const queries: Array<Query> = [
    {
      list: {
        models: null,
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
  ];

  const transaction = new Transaction(queries);

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets" FROM "ronin_schema"',
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  // Assert that the `fields`, `indexes`, and `presets` properties are formatted
  // correctly, in order to match the `Model` type.
  expect(result.records).toEqual([
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Account',
      pluralName: 'Accounts',
      slug: 'account',
      pluralSlug: 'accounts',
      idPrefix: 'acc',
      identifiers: {
        name: 'id',
        slug: 'id',
      },
      table: 'accounts',
      fields: {
        ...getSystemFields('acc'),
        handle: {
          name: 'Handle',
          type: 'string',
        },
      },
      indexes: {},
      presets: {},
    },
  ]);
});

test('list existing model', async () => {
  const queries: Array<Query> = [
    {
      list: {
        model: 'account',
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
  ];

  const transaction = new Transaction(queries);

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets" FROM "ronin_schema" WHERE "slug" = ?1 LIMIT 1',
      params: ['account'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  // Assert that the `fields`, `indexes`, and `presets` properties are formatted
  // correctly, in order to match the `Model` type.
  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    name: 'Account',
    pluralName: 'Accounts',
    slug: 'account',
    pluralSlug: 'accounts',
    idPrefix: 'acc',
    identifiers: {
      name: 'id',
      slug: 'id',
    },
    table: 'accounts',
    fields: {
      ...getSystemFields('acc'),
      handle: {
        name: 'Handle',
        type: 'string',
      },
    },
    indexes: {},
    presets: {},
  });
});

// Ensure that, if the `slug` of a model changes during an update, an `ALTER TABLE`
// statement is generated for it.
test('alter existing model (slug)', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        to: {
          slug: 'user',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'ALTER TABLE "accounts" RENAME TO "users"',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "slug" = ?1, "pluralSlug" = ?2, "table" = ?3, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?4 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: ['user', 'users', 'users', 'account'],
      returning: true,
    },
  ]);
});

// Ensure that, if the `slug` of a model that has system models associatied with it
// changes during an update, `ALTER TABLE` statements are generated for the system models.
test('alter existing model (slug) that has system models associated with it', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'user',
        to: {
          slug: 'account',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'post',
    },
    {
      slug: 'user',
      fields: {
        likes: {
          type: 'link',
          target: 'post',
          kind: 'many',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'ALTER TABLE "users" RENAME TO "accounts"',
      params: [],
    },
    {
      sql: 'ALTER TABLE "ronin_link_user_likes" RENAME TO "ronin_link_account_likes"',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "slug" = ?1, "pluralSlug" = ?2, "table" = ?3, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?4 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: ['account', 'accounts', 'accounts', 'user'],
      returning: true,
    },
  ]);
});

// Ensure that, if the `slug` of a model does not change during an update, no
// unnecessary `ALTER TABLE` statement is generated for it.
test('alter existing model (plural name)', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        to: {
          pluralName: 'Signups',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "ronin_schema" SET "pluralName" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: ['Signups', 'account'],
      returning: true,
    },
  ]);
});

test('drop existing model', () => {
  const queries: Array<Query> = [
    {
      drop: {
        model: 'account',
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'DROP TABLE "accounts"',
      params: [],
    },
    {
      sql: 'DELETE FROM "ronin_schema" WHERE "slug" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"',
      params: ['account'],
      returning: true,
    },
  ]);
});

// Assert whether the system models associated with the model are correctly cleaned up.
test('drop existing model that has system models associated with it', () => {
  const queries: Array<Query> = [
    {
      drop: {
        model: 'account',
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        followers: {
          type: 'link',
          target: 'account',
          kind: 'many',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements[1]).toEqual({
    sql: 'DROP TABLE "ronin_link_account_followers"',
    params: [],
  });
});

test('query a model that was just created', () => {
  const queries: Array<Query> = [
    {
      create: {
        model: {
          slug: 'account',
        },
      },
    },
    {
      get: {
        account: null,
      },
    },
    {
      drop: {
        model: 'account',
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  // Assert whether the statements are generated in the correct order, meaning in the
  // order in which the queries are provided.
  expect(transaction.statements.map(({ sql }) => sql)).toEqual([
    `CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY DEFAULT ('acc_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT)`,
    'INSERT INTO "ronin_schema" ("slug", "id", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields") VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"',
    'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts" LIMIT 1',
    'DROP TABLE "accounts"',
    'DELETE FROM "ronin_schema" WHERE "slug" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"',
  ]);
});

test('query a model that was just updated', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        to: {
          slug: 'user',
        },
      },
    },
    {
      get: {
        user: null,
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  // Assert whether the statements are generated in the correct order, meaning in the
  // order in which the queries are provided.
  expect(transaction.statements.map(({ sql }) => sql)).toEqual([
    'ALTER TABLE "accounts" RENAME TO "users"',
    `UPDATE "ronin_schema" SET "slug" = ?1, "pluralSlug" = ?2, "table" = ?3, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?4 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
    'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "users" LIMIT 1',
  ]);
});

test('query a model that was just dropped', () => {
  const queries: Array<Query> = [
    {
      drop: {
        model: 'account',
      },
    },
    {
      get: {
        account: null,
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
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
    'No matching model with either Slug or Plural Slug of "account" could be found.',
  );
  expect(error).toHaveProperty('code', 'MODEL_NOT_FOUND');
});

test('create new field', async () => {
  // Fields don't need to have a type when being created. The default type is "string".
  const field: ModelField = {
    slug: 'email',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          field,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  const finalField = { ...omit(field, ['slug']), type: 'string', name: 'Email' };

  expect(transaction.statements).toEqual([
    {
      sql: 'ALTER TABLE "accounts" ADD COLUMN "email" TEXT',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_insert("fields", '$.email', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(finalField), 'account'],
      returning: true,
    },
  ]);

  // Assert that the models within the transaction (in memory) were updated correctly.
  expect(transaction.models[1].fields).toHaveProperty(field.slug, finalField);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toHaveProperty('fields', {
    ...getSystemFields('acc'),
    [field.slug]: finalField,
  });
});

test('create new field with options', () => {
  const field: ModelField = {
    slug: 'account',
    type: 'link',
    target: 'account',
    actions: {
      onDelete: 'CASCADE',
    },
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'member',
        create: {
          field,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'member',
    },
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'ALTER TABLE "members" ADD COLUMN "account" TEXT REFERENCES accounts("id") ON DELETE CASCADE',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_insert("fields", '$.account', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify({ ...omit(field, ['slug']), name: 'Account' }), 'member'],
      returning: true,
    },
  ]);
});

test('create new field with many-cardinality relationship', () => {
  const field: ModelField = {
    slug: 'followers',
    type: 'link',
    target: 'account',
    kind: 'many',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          field,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `CREATE TABLE "ronin_link_account_followers" ("id" TEXT PRIMARY KEY DEFAULT ('ron_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "source" TEXT REFERENCES accounts("id") ON DELETE CASCADE ON UPDATE CASCADE, "target" TEXT REFERENCES accounts("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_insert("fields", '$.followers', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [
        JSON.stringify({ ...omit(field, ['slug']), name: 'Followers' }),
        'account',
      ],
      returning: true,
    },
  ]);
});

// Assert that objects are being accepted as default values of JSON fields.
test('create new field with default value (json)', async () => {
  const field: ModelField = {
    type: 'json',
    slug: 'settings',
    defaultValue: {
      theme: 'light',
    },
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          field,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  const finalField = { ...omit(field, ['slug']), name: 'Settings' };

  expect(transaction.statements).toEqual([
    {
      sql: `ALTER TABLE "accounts" ADD COLUMN "settings" TEXT DEFAULT '{"theme":"light"}'`,
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_insert("fields", '$.settings', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(finalField), 'account'],
      returning: true,
    },
  ]);

  // Assert that the models within the transaction (in memory) were updated correctly.
  expect(transaction.models[1].fields).toHaveProperty(field.slug, finalField);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toHaveProperty('fields', {
    ...getSystemFields('acc'),
    [field.slug]: finalField,
  });
});

// Assert that invalid objects are being rejected as default values of JSON fields.
test('create new field with default value (invalid json)', () => {
  const field: ModelField = {
    type: 'json',
    slug: 'settings',
    defaultValue: 'test',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          field,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
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
    'The default value of JSON field "settings" must be an object.',
  );
  expect(error).toHaveProperty('code', 'INVALID_MODEL_VALUE');
  expect(error).toHaveProperty('field', 'fields');
});

// Ensure that, if the `slug` of a field changes during a model update, an `ALTER TABLE`
// statement is generated for it.
test('alter existing field (slug)', () => {
  const newFieldDetails: Partial<ModelField> = {
    slug: 'emailAddress',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        alter: {
          field: 'email',
          to: newFieldDetails,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'ALTER TABLE "accounts" RENAME COLUMN "email" TO "emailAddress"',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_insert(json_remove("fields", '$.email'), '$.emailAddress', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify({ type: 'string', name: 'Email Address' }), 'account'],
      returning: true,
    },
  ]);
});

// Assert that the tables of the system models associated with the field are correctly
// renamed when the column of the field is renamed.
test('alter existing field (slug) with many-cardinality relationship', () => {
  const newFieldDetails: Partial<ModelField> = {
    slug: 'subscribers',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        alter: {
          field: 'followers',
          to: newFieldDetails,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        followers: {
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
      sql: 'ALTER TABLE "ronin_link_account_followers" RENAME TO "ronin_link_account_subscribers"',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_insert(json_remove("fields", '$.followers'), '$.subscribers', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [
        JSON.stringify({
          type: 'link',
          target: 'account',
          kind: 'many',
          name: 'Subscribers',
        }),
        'account',
      ],
      returning: true,
    },
  ]);
});

// Ensure that, if the `slug` of a field does not change during a model update, no
// unnecessary `ALTER TABLE` statement is generated for it.
test('alter existing field (name)', () => {
  const newFieldDetails: Partial<ModelField> = {
    name: 'Email Address',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        alter: {
          field: 'email',
          to: newFieldDetails,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_set("fields", '$.email', json_patch(json_extract("fields", '$.email'), ?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(newFieldDetails), 'account'],
      returning: true,
    },
  ]);
});

test('drop existing field', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        drop: {
          field: 'email',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'ALTER TABLE "accounts" DROP COLUMN "email"',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_remove("fields", '$.email'), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: ['account'],
      returning: true,
    },
  ]);
});

// Assert whether the system models associated with the field are correctly cleaned up
// and that no `ALTER TABLE` statement is generated for the field.
test('drop existing field that has system models associated with it', () => {
  const field: ModelField = {
    slug: 'followers',
    type: 'link',
    target: 'account',
    kind: 'many',
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        drop: {
          field: field.slug,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        followers: {
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
      sql: 'DROP TABLE "ronin_link_account_followers"',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "fields" = json_remove("fields", '$.followers'), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: ['account'],
      returning: true,
    },
  ]);
});

// Assert that only the system models associated with the dropped field are cleaned up,
// and that the other system models associated with the same model are left untouched.
test('drop existing field on model with other many-cardinality fields', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        drop: {
          field: 'subscribers',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        followers: {
          type: 'link',
          target: 'account',
          kind: 'many',
        },
        subscribers: {
          type: 'link',
          target: 'account',
          kind: 'many',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements[0]).toEqual({
    sql: 'DROP TABLE "ronin_link_account_subscribers"',
    params: [],
  });
});

test('create new index', async () => {
  const index: ModelIndex = {
    slug: 'indexSlug',
    fields: [
      {
        slug: 'email',
      },
    ],
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          index,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  const finalIndex = omit(index, ['slug']);

  expect(transaction.statements).toEqual([
    {
      sql: 'CREATE INDEX "index_slug" ON "accounts" ("email")',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "indexes" = json_insert("indexes", '$.indexSlug', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(finalIndex), 'account'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toHaveProperty('indexes', {
    indexSlug: finalIndex,
  });
});

test('create new index with filter', () => {
  const index: ModelIndex = {
    slug: 'indexSlug',
    fields: [
      {
        slug: 'email',
      },
    ],
    filter: {
      email: {
        endingWith: '@site.co',
      },
    },
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          index,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `CREATE INDEX "index_slug" ON "accounts" ("email") WHERE ("email" LIKE '%@site.co')`,
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "indexes" = json_insert("indexes", '$.indexSlug', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(omit(index, ['slug'])), 'account'],
      returning: true,
    },
  ]);
});

test('create new index with field expressions', () => {
  const index: ModelIndex = {
    slug: 'indexSlug',
    fields: [
      {
        expression: `LOWER(${QUERY_SYMBOLS.FIELD}firstName || ' ' || ${QUERY_SYMBOLS.FIELD}lastName)`,
      },
    ],
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          index,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `CREATE INDEX "index_slug" ON "accounts" (LOWER("firstName" || ' ' || "lastName"))`,
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "indexes" = json_insert("indexes", '$.indexSlug', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(omit(index, ['slug'])), 'account'],
      returning: true,
    },
  ]);
});

test('create new index with ordered and collated fields', () => {
  const index: ModelIndex = {
    slug: 'indexSlug',
    fields: [
      {
        slug: 'email',
        order: 'ASC',
        collation: 'NOCASE',
      },
    ],
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          index,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'CREATE INDEX "index_slug" ON "accounts" ("email" COLLATE NOCASE ASC)',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "indexes" = json_insert("indexes", '$.indexSlug', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(omit(index, ['slug'])), 'account'],
      returning: true,
    },
  ]);
});

test('create new unique index', () => {
  const index: ModelIndex = {
    slug: 'indexSlug',
    fields: [
      {
        slug: 'email',
      },
    ],
    unique: true,
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          index,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'CREATE UNIQUE INDEX "index_slug" ON "accounts" ("email")',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "indexes" = json_insert("indexes", '$.indexSlug', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(omit(index, ['slug'])), 'account'],
      returning: true,
    },
  ]);
});

test('drop existing index', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        drop: {
          index: 'indexSlug',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
      indexes: {
        indexSlug: {
          fields: [{ slug: 'email' }],
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'DROP INDEX "index_slug"',
      params: [],
    },
    {
      sql: `UPDATE "ronin_schema" SET "indexes" = json_remove("indexes", '$.indexSlug'), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: ['account'],
      returning: true,
    },
  ]);
});

test('create new preset', async () => {
  const preset: ModelPreset = {
    slug: 'companyEmployees',
    instructions: {
      with: {
        email: {
          endingWith: '@company.co',
        },
      },
    },
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          preset,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  const finalPreset = omit(preset, ['slug']);

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "ronin_schema" SET "presets" = json_insert("presets", '$.companyEmployees', json(?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(finalPreset), 'account'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toHaveProperty('presets', {
    companyEmployees: finalPreset,
  });
});

test('alter existing preset', () => {
  const newPresetDetails: Partial<ModelPreset> = {
    instructions: {
      with: {
        email: {
          endingWith: '@site.co',
        },
      },
    },
  };

  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        alter: {
          preset: 'companyEmployees',
          to: newPresetDetails,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
      presets: {
        companyEmployees: {
          instructions: { with: { email: 'test@site.org' } },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "ronin_schema" SET "presets" = json_set("presets", '$.companyEmployees', json_patch(json_extract("presets", '$.companyEmployees'), ?1)), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: [JSON.stringify(newPresetDetails), 'account'],
      returning: true,
    },
  ]);
});

test('drop existing preset', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        drop: {
          preset: 'companyEmployees',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        email: { type: 'string' },
      },
      presets: {
        companyEmployees: {
          instructions: { with: { email: 'test' } },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "ronin_schema" SET "presets" = json_remove("presets", '$.companyEmployees'), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "slug" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "presets"`,
      params: ['account'],
      returning: true,
    },
  ]);
});

// Assert that no entry in `ronin_schema` is created when the root model is created.
test('create the root model', () => {
  const queries: Array<Query> = [
    {
      create: {
        model: ROOT_MODEL,
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `CREATE TABLE "ronin_schema" ("id" TEXT PRIMARY KEY DEFAULT ('mod_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "name" TEXT, "pluralName" TEXT, "slug" TEXT, "pluralSlug" TEXT, "idPrefix" TEXT, "table" TEXT, "identifiers.name" TEXT, "identifiers.slug" TEXT, "fields" TEXT DEFAULT '{}', "indexes" TEXT DEFAULT '{}', "presets" TEXT DEFAULT '{}')`,
      params: [],
    },
  ]);
});

test('drop the root model', () => {
  const queries: Array<Query> = [
    {
      drop: {
        model: ROOT_MODEL.slug,
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'DROP TABLE "ronin_schema"',
      params: [],
    },
  ]);
});

test('try to alter existing model that does not exist', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        to: {
          slug: 'user',
        },
      },
    },
  ];

  const models: Array<Model> = [];

  let error: Error | undefined;

  try {
    new Transaction(queries, { models });
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(CompilerError);
  expect(error).toHaveProperty(
    'message',
    'No matching model with either Slug or Plural Slug of "account" could be found.',
  );
  expect(error).toHaveProperty('code', 'MODEL_NOT_FOUND');
});

test('try to alter existing model entity that does not exist', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        drop: {
          field: 'email',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
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
    'No field with slug "email" defined in model "Account".',
  );
  expect(error).toHaveProperty('code', 'FIELD_NOT_FOUND');
});

test('try to create new entity with slug of existing entity', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          field: {
            slug: 'id',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  let error: Error | undefined;

  try {
    new Transaction(queries, { models });
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(CompilerError);
  expect(error).toHaveProperty('message', 'A field with the slug "id" already exists.');
  expect(error).toHaveProperty('code', 'EXISTING_MODEL_ENTITY');
});

test('try to drop a system field', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        drop: {
          field: 'id',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
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
    'The field "id" is a system field and cannot be removed.',
  );
  expect(error).toHaveProperty('code', 'REQUIRED_MODEL_ENTITY');
});

test('try to create new index without fields', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          index: {
            slug: 'indexSlug',
            unique: true,
            // @ts-expect-error This property already includes a strict type guard
            fields: [],
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
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
    'When creating indexes, at least one field must be provided.',
  );
  expect(error).toHaveProperty('code', 'INVALID_MODEL_VALUE');
  expect(error).toHaveProperty('field', 'indexes');
});

test('try to create new index with non-existent field', () => {
  const queries: Array<Query> = [
    {
      alter: {
        model: 'account',
        create: {
          index: {
            slug: 'indexSlug',
            unique: true,
            fields: [
              {
                slug: 'handle',
              },
            ],
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
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
    'Field "handle" defined for index "index_slug" does not exist in model "Account".',
  );
  expect(error).toHaveProperty('code', 'FIELD_NOT_FOUND');
});
