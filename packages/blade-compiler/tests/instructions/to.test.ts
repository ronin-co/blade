import { expect, test } from 'bun:test';

import { RECORD_TIMESTAMP_REGEX, queryEphemeralDatabase } from '@/fixtures/utils';
import {
  CompilerError,
  type Model,
  QUERY_SYMBOLS,
  type Query,
  type StoredObject,
  Transaction,
} from '@/src/index';
import type { MultipleRecordResult, SingleRecordResult } from '@/src/types/result';

test('set single record to new string field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            handle: 'mia',
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
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "handle" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"`,
      params: ['mia', 'elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('mia');
});

test('set single record to new blob field', async () => {
  const storedObject: StoredObject = {
    key: 'test-key',
    name: 'example.png',
    src: 'https://storage.ronin.co/test-key',
    meta: {
      height: 100,
      width: 100,
      size: 100,
      type: 'image/png',
    },
    placeholder: {
      base64: '',
    },
  };

  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            avatar: storedObject,
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
        avatar: {
          type: 'blob',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "avatar" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "avatar"`,
      params: [JSON.stringify(storedObject), 'elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.avatar).toMatchObject(storedObject);
});

test('set single record to new blob field with invalid value', () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            avatar: 'storedObject',
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
        avatar: {
          type: 'blob',
        },
      },
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
    'The provided field value is not a valid Blob reference.',
  );
  expect(error).toHaveProperty('code', 'INVALID_FIELD_VALUE');
  expect(error).toHaveProperty('field', 'avatar');
});

test('set single record to new blob field with empty value', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            avatar: null,
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
        avatar: {
          type: 'blob',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "avatar" = NULL, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "avatar"`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.avatar).toBeNull();
});

test('set single record to new string field with expression referencing fields', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            handle: {
              [QUERY_SYMBOLS.EXPRESSION]: `LOWER(${QUERY_SYMBOLS.FIELD}firstName || ${QUERY_SYMBOLS.FIELD}lastName)`,
            },
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
        firstName: {
          type: 'string',
        },
        lastName: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "handle" = LOWER("firstName" || "lastName"), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "firstName", "lastName"`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('elainejones');
});

test('set single record to new one-cardinality link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        member: {
          with: {
            id: 'mem_39h8fhe98hefah9j',
          },
          to: {
            account: {
              handle: 'elaine',
            },
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
      sql: `UPDATE "members" SET "account" = (SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "id" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account"`,
      params: ['elaine', 'mem_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const [[targetRecord]] = await queryEphemeralDatabase(models, [
    {
      sql: `SELECT * FROM "accounts" WHERE ("handle" = 'elaine') LIMIT 1`,
      params: [],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.account).toBe(targetRecord.id);
});

test('add single record with many-cardinality link field (add)', async () => {
  const queries: Array<Query> = [
    {
      add: {
        account: {
          with: {
            handle: 'markus',
            followers: [{ handle: 'david' }],
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
      sql: `INSERT INTO "accounts" ("handle") VALUES (?1) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"`,
      params: ['markus'],
      returning: true,
    },
    {
      sql: 'INSERT INTO "ronin_link_account_followers" ("source", "target") VALUES ((SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1), (SELECT "id" FROM "accounts" WHERE "handle" = ?2 LIMIT 1))',
      params: ['markus', 'david'],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    handle: 'markus',
  });

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new many-cardinality link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            followers: [{ handle: 'david' }],
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
      sql: `UPDATE "accounts" SET "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"`,
      params: ['elaine'],
      returning: true,
    },
    {
      sql: 'DELETE FROM "ronin_link_account_followers" WHERE "source" = (SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1)',
      params: ['elaine'],
    },
    {
      sql: 'INSERT INTO "ronin_link_account_followers" ("source", "target") VALUES ((SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1), (SELECT "id" FROM "accounts" WHERE "handle" = ?2 LIMIT 1))',
      params: ['elaine', 'david'],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new many-cardinality link field (add)', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            followers: {
              containing: [{ handle: 'david' }],
            },
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
      sql: `UPDATE "accounts" SET "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"`,
      params: ['elaine'],
      returning: true,
    },
    {
      sql: 'INSERT INTO "ronin_link_account_followers" ("source", "target") VALUES ((SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1), (SELECT "id" FROM "accounts" WHERE "handle" = ?2 LIMIT 1))',
      params: ['elaine', 'david'],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new many-cardinality link field (remove)', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            followers: {
              notContaining: [{ handle: 'david' }],
            },
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
      sql: `UPDATE "accounts" SET "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"`,
      params: ['elaine'],
      returning: true,
    },
    {
      sql: 'DELETE FROM "ronin_link_account_followers" WHERE "source" = (SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1) AND "target" = (SELECT "id" FROM "accounts" WHERE "handle" = ?2 LIMIT 1)',
      params: ['elaine', 'david'],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new json field with array', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            emails: ['elaine@site.co', 'elaine@company.co'],
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "emails" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "emails"`,
      params: ['["elaine@site.co","elaine@company.co"]', 'elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.emails).toEqual(['elaine@site.co', 'elaine@company.co']);
});

test('set single record to new json field with object', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            emails: {
              site: 'elaine@site.co',
              hobby: 'dancer@dancing.co',
            },
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "emails" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "emails"`,
      params: ['{"site":"elaine@site.co","hobby":"dancer@dancing.co"}', 'elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.emails).toEqual({
    site: 'elaine@site.co',
    hobby: 'dancer@dancing.co',
  });
});

test('set single record to new json field with invalid value', () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            emails: 'elaine@site.co',
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

  let error: Error | undefined;

  try {
    new Transaction(queries, { models });
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(CompilerError);
  expect(error).toHaveProperty(
    'message',
    'The provided field value is not valid JSON. Only objects and arrays should be provided. Other types of values should be stored in their respective primitive field types.',
  );
  expect(error).toHaveProperty('code', 'INVALID_FIELD_VALUE');
  expect(error).toHaveProperty('field', 'emails');
});

test('set single record to new json field with empty value', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            emails: null,
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "emails" = NULL, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "emails"`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.emails).toBeNull();
});

test('set single record to new nested string field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah8j',
          },
          to: {
            billing: {
              currency: 'USD',
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: {
        'billing.currency': {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "teams" SET "billing.currency" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "id" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "billing.currency"`,
      params: ['USD', 'tea_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect((result.record?.billing as { currency: string })?.currency).toBe('USD');
});

test('set single record to new nested link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah8j',
          },
          to: {
            billing: {
              manager: {
                handle: 'elaine',
              },
            },
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
      },
    },
    {
      slug: 'team',
      fields: {
        'billing.manager': {
          type: 'link',
          target: 'account',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "teams" SET "billing.manager" = (SELECT "id" FROM "accounts" WHERE "handle" = ?1 LIMIT 1), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "id" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "billing.manager"`,
      params: ['elaine', 'tea_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const [[targetRecord]] = await queryEphemeralDatabase(models, [
    {
      sql: `SELECT * FROM "accounts" WHERE ("handle" = 'elaine') LIMIT 1`,
      params: [],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect((result.record?.billing as { manager: string })?.manager).toBe(targetRecord.id);
});

test('set single record to new nested json field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah9j',
          },
          to: {
            billing: {
              invoiceRecipients: ['receipts@test.co'],
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: {
        'billing.invoiceRecipients': {
          type: 'json',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "teams" SET "billing.invoiceRecipients" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "id" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "billing.invoiceRecipients"`,
      params: ['["receipts@test.co"]', 'tea_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(
    (result.record?.billing as { invoiceRecipients: Array<string> })?.invoiceRecipients,
  ).toEqual(['receipts@test.co']);
});

test('set single record to result of nested query', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah9j',
          },
          to: {
            name: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  account: {
                    with: { handle: 'david' },
                    selecting: ['lastName'],
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
        lastName: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "teams" SET "name" = (SELECT "lastName" FROM "accounts" WHERE "handle" = ?1 LIMIT 1), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "id" = ?2 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name"`,
      params: ['david', 'tea_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const [[targetRecord]] = await queryEphemeralDatabase(models, [
    {
      sql: `SELECT lastName FROM "accounts" WHERE ("handle" = 'david') LIMIT 1`,
      params: [],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.name).toBe(targetRecord.lastName);
});

test('set single record to empty field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            handle: null,
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
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `UPDATE "accounts" SET "handle" = NULL, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.handle).toBe(null);
});

test('add multiple records with nested sub query', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          with: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: null,
              },
            },
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
      },
    },
    {
      slug: 'user',
      fields: {
        handle: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'INSERT INTO "users" SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"',
      params: [],
      returning: true,
    },
  ]);

  const [targetRecords] = await queryEphemeralDatabase(models, [
    {
      sql: `SELECT * FROM "accounts"`,
      params: [],
    },
    ...transaction.statements,
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(result.records.map(({ handle }) => ({ handle }))).toEqual(
    targetRecords.map(({ handle }) => ({ handle })),
  );
});

test('add multiple records with nested sub query including additional fields', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          with: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: {
                  including: {
                    nonExistingField: 'Custom Field Value',
                  },
                },
              },
            },
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
      },
    },
    {
      slug: 'user',
      fields: {
        handle: {
          type: 'string',
        },
        nonExistingField: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'INSERT INTO "users" SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", ?1 as "nonExistingField" FROM "accounts" RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "nonExistingField"',
      params: ['Custom Field Value'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      nonExistingField: 'Custom Field Value',
    },
    {
      nonExistingField: 'Custom Field Value',
    },
  ]);
});

test('add multiple records with nested sub query and specific fields', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          with: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: {
                  selecting: ['handle'],
                },
              },
            },
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
      },
    },
    {
      slug: 'user',
      fields: {
        handle: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'INSERT INTO "users" ("handle") SELECT "handle" FROM "accounts" RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"',
      params: [],
      returning: true,
    },
  ]);

  const [targetRecords] = await queryEphemeralDatabase(models, [
    {
      sql: `SELECT * FROM "accounts"`,
      params: [],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(result.records.map(({ handle }) => ({ handle }))).toEqual(
    targetRecords.map(({ handle }) => ({ handle })),
  );
});

test('add multiple records with nested sub query and specific meta fields', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          with: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: {
                  selecting: ['ronin.updatedAt'],
                },
              },
            },
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
      slug: 'user',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'INSERT INTO "users" ("ronin.updatedAt") SELECT "ronin.updatedAt" FROM "accounts" RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy"',
      params: [],
      returning: true,
    },
  ]);

  const [targetRecords] = await queryEphemeralDatabase(models, [
    {
      sql: `SELECT * FROM "accounts"`,
      params: [],
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(
    result.records.map(({ ronin: { updatedAt } }) => ({ ronin: { updatedAt } })),
  ).toEqual(
    targetRecords.map((targetRecord) => ({
      ronin: { updatedAt: targetRecord['ronin.updatedAt'] },
    })),
  );
});

// Ensure that an error is thrown for fields that don't exist in the target model, since
// the value of the field cannot be used in those cases.
test('try to add multiple records with nested sub query including non-existent fields', () => {
  const queries: Array<Query> = [
    {
      add: {
        newAccounts: {
          with: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                oldAccounts: {
                  including: {
                    nonExistingField: 'custom-value',
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'oldAccount',
      fields: {
        handle: {
          type: 'string',
        },
      },
    },
    {
      slug: 'newAccount',
      fields: {
        handle: {
          type: 'string',
        },
      },
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
    'Field "nonExistingField" defined for `to` does not exist in model "New Account".',
  );
  expect(error).toHaveProperty('code', 'FIELD_NOT_FOUND');
  expect(error).toHaveProperty('field', 'nonExistingField');
});
