import { expect, test } from 'bun:test';
import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { MultipleRecordResult, SingleRecordResult } from '@/src/types/result';

test('get single record with specific field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        category: {
          selecting: ['id'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'category',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "id" FROM "categories" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    id: expect.stringMatching(RECORD_ID_REGEX),
  });
});

test('get single record with specific fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['id', 'name'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "id", "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    id: expect.stringMatching(RECORD_ID_REGEX),
    name: expect.any(String),
  });
});

test('get single record with specific fields (root level)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['*'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "id", "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    id: expect.stringMatching(RECORD_ID_REGEX),
    name: expect.any(String),
  });
});

test('get single record with specific fields (root level, except)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['*', '!id'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    name: expect.any(String),
  });
});

test('get single record with specific fields (root level, any prefix)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['*ame'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    name: expect.any(String),
  });
});

test('get single record with specific fields (root level, any suffix)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['na*'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    name: expect.any(String),
  });
});

test('get single record with specific fields (all levels)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['**'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    id: expect.stringMatching(RECORD_ID_REGEX),
    name: expect.any(String),
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
  });
});

test('get single record with specific fields (all levels, except)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['**', '!id'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    name: expect.any(String),
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
  });
});

test('get single record with specific fields (all levels, any prefix)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['**.createdAt'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "ronin.createdAt" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
    },
  });
});

test('get single record with specific fields (all levels, any suffix)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['ronin.**'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    ronin: {
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
    },
  });
});

test('select same fields as preset does', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          using: ['links', 'preset'],
          limitedTo: 50,
          selecting: ['id', 'name', 'division', 'ronin.createdAt'],
          with: { name: { containing: 'B' } },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: {
        name: {
          type: 'string',
        },
        division: {
          type: 'string',
        },
      },
      presets: {
        preset: {
          name: 'Beaches',
          instructions: {
            selecting: ['id', 'name', 'division'],
          },
          system: true,
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT "id", "name", "division", "ronin.createdAt" FROM "beaches" WHERE "name" LIKE ?1 ORDER BY "ronin.createdAt" DESC LIMIT 51',
      params: ['%B%'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      name: expect.any(String),
      division: expect.any(String),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      },
    },
  ]);
});
