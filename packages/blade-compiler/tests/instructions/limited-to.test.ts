import { expect, test } from 'bun:test';
import { PAGINATION_CURSOR_REGEX, queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { MultipleRecordResult } from '@/src/types/result';

test('get multiple records limited to amount', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          limitedTo: 2,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "beaches" ORDER BY "ronin.createdAt" DESC LIMIT 3',
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(result.records).toHaveLength(2);
  expect(result.moreBefore).toBeUndefined();
  expect(result.moreAfter).toMatch(PAGINATION_CURSOR_REGEX);
});

test('get multiple records limited to amount ordered by link field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        members: {
          limitedTo: 2,
          orderedBy: {
            descending: ['account'],
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
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account" FROM "members" ORDER BY "account" DESC, "ronin.createdAt" DESC LIMIT 3',
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(result.records).toHaveLength(2);
  expect(result.moreBefore).toBeUndefined();
  expect(result.moreAfter).toStartWith('acc_39h8fhe98hefah8j');
});
