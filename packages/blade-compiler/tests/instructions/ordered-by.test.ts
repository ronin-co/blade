import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, QUERY_SYMBOLS, type Query, Transaction } from '@/src/index';
import type { MultipleRecordResult } from '@/src/types/result';

test('get multiple records ordered by field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: ['handle'],
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
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" ORDER BY "handle" COLLATE NOCASE ASC`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      handle: 'david',
    },
    {
      handle: 'elaine',
    },
  ]);
});

test('get multiple records ordered by expression', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: [
              {
                [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD}firstName || ' ' || ${QUERY_SYMBOLS.FIELD}lastName`,
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
      fields: {
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
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "firstName", "lastName" FROM "accounts" ORDER BY ("firstName" || ' ' || "lastName") ASC`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      firstName: 'David',
      lastName: 'Brown',
    },
    {
      firstName: 'Elaine',
      lastName: 'Jones',
    },
  ]);
});

test('get multiple records ordered by multiple fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: ['handle', 'lastName'],
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
        lastName: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "lastName" FROM "accounts" ORDER BY "handle" COLLATE NOCASE ASC, "lastName" COLLATE NOCASE ASC`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      handle: 'david',
      lastName: 'Brown',
    },
    {
      handle: 'elaine',
      lastName: 'Jones',
    },
  ]);
});
