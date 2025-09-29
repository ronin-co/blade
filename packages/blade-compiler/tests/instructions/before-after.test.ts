import { expect, test } from 'bun:test';
import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import { CompilerError, type Model, type Query, Transaction } from '@/src/index';
import type {
  AmountResult,
  MultipleRecordResult,
  ResultRecord,
} from '@/src/types/result';
import { CURSOR_NULL_PLACEHOLDER } from '@/src/utils/pagination';

test('get multiple records before cursor', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: '1733654878079',
          limitedTo: 2,
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
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" WHERE (("ronin.createdAt" > '2024-12-08T10:47:58.079Z')) ORDER BY "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordTime = new Date('2024-12-10T10:47:58.079Z');
  const lastRecordTime = new Date('2024-12-09T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'bea_39h8fhe98hefah9j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Manly',
    },
    {
      id: 'bea_39h8fhe98hefah0j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Coogee',
    },
  ]);

  expect(result.moreBefore).toBe(firstRecordTime.getTime().toString());
  expect(result.moreAfter).toBe(lastRecordTime.getTime().toString());
});

// Assert that the `ronin.createdAt` field is being selected in the SQL statement, since
// it is needed for the pagination cursor.
test('get multiple records before cursor while selecting fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: '1733654878079',
          limitedTo: 2,
          selecting: ['name'],
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
      sql: `SELECT "name", "ronin.createdAt" FROM "beaches" WHERE (("ronin.createdAt" > '2024-12-08T10:47:58.079Z')) ORDER BY "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordTime = new Date('2024-12-10T10:47:58.079Z');
  const lastRecordTime = new Date('2024-12-09T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      name: 'Manly',
    },
    {
      name: 'Coogee',
    },
  ] as unknown as Array<ResultRecord>);

  expect(result.moreBefore).toBe(firstRecordTime.getTime().toString());
  expect(result.moreAfter).toBe(lastRecordTime.getTime().toString());
});

test('get multiple records before cursor ordered by string field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: 'Manly,1733827678079',
          orderedBy: {
            ascending: ['name'],
          },
          limitedTo: 2,
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
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" WHERE ((IFNULL("name", -1e999) < ?1 COLLATE NOCASE) OR ("name" = ?1 AND ("ronin.createdAt" > '2024-12-10T10:47:58.079Z'))) ORDER BY "name" COLLATE NOCASE ASC, "ronin.createdAt" DESC LIMIT 3`,
      params: ['Manly'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordName = 'Coogee';
  const firstRecordTime = new Date('2024-12-09T10:47:58.079Z');

  const lastRecordName = 'Cronulla';
  const lastRecordTime = new Date('2024-12-08T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'bea_39h8fhe98hefah0j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Coogee',
    },
    {
      id: 'bea_39h8fhe98hefah1j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: lastRecordName,
    },
  ]);

  expect(result.moreBefore).toBe(`${firstRecordName},${firstRecordTime.getTime()}`);
  expect(result.moreAfter).toBe(`${lastRecordName},${lastRecordTime.getTime()}`);
});

// Assert that the `name` field and the `ronin.createdAt` field are being selected in the
// SQL statement, since they are needed for the pagination cursor.
test('get multiple records before cursor ordered by string field, while selecting fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: 'Manly,1733827678079',
          orderedBy: {
            ascending: ['name'],
          },
          limitedTo: 2,
          // Here, we must select a field that is *not* used for ordering.
          selecting: ['division'],
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
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "division", "name", "ronin.createdAt" FROM "beaches" WHERE ((IFNULL("name", -1e999) < ?1 COLLATE NOCASE) OR ("name" = ?1 AND ("ronin.createdAt" > '2024-12-10T10:47:58.079Z'))) ORDER BY "name" COLLATE NOCASE ASC, "ronin.createdAt" DESC LIMIT 3`,
      params: ['Manly'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordName = 'Coogee';
  const firstRecordTime = new Date('2024-12-09T10:47:58.079Z');

  const lastRecordName = 'Cronulla';
  const lastRecordTime = new Date('2024-12-08T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      division: 'Kingsford',
    },
    {
      division: 'Cook',
    },
  ] as unknown as Array<ResultRecord>);

  expect(result.moreBefore).toBe(`${firstRecordName},${firstRecordTime.getTime()}`);
  expect(result.moreAfter).toBe(`${lastRecordName},${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor ordered by boolean field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        members: {
          before: 'true,1728470878079',
          orderedBy: {
            ascending: ['pending'],
          },
          limitedTo: 2,
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "pending" FROM "members" WHERE ((IFNULL("pending", -1e999) < ?1) OR ("pending" = ?1 AND ("ronin.createdAt" > '2024-10-09T10:47:58.079Z'))) ORDER BY "pending" ASC, "ronin.createdAt" DESC LIMIT 3`,
      params: [1],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordPending = false;
  const firstRecordTime = new Date('2024-11-10T10:47:58.079Z');

  const lastRecordPending = true;
  const lastRecordTime = new Date('2024-12-11T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'mem_39h8fhe98hefah9j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      pending: firstRecordPending,
    },
    {
      id: 'mem_39h8fhe98hefah8j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      pending: lastRecordPending,
    },
  ]);

  expect(result.moreBefore).toBeUndefined();
  expect(result.moreAfter).toBe(`${lastRecordPending},${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor ordered by number field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        products: {
          before: '1,1733914078079',
          orderedBy: {
            descending: ['position'],
          },
          limitedTo: 2,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'product',
      fields: {
        position: {
          type: 'number',
        },
        name: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "position", "name" FROM "products" WHERE (("position" > ?1) OR ("position" = ?1 AND ("ronin.createdAt" > '2024-12-11T10:47:58.079Z'))) ORDER BY "position" DESC, "ronin.createdAt" DESC LIMIT 3`,
      params: [1],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordPosition = 3;
  const firstRecordTime = new Date('2024-12-09T10:47:58.079Z');

  const lastRecordPosition = 2;
  const lastRecordTime = new Date('2024-12-10T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'pro_39h8fhe98hefah0j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Cherry',
      position: firstRecordPosition,
    },
    {
      id: 'pro_39h8fhe98hefah9j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Banana',
      position: lastRecordPosition,
    },
  ]);

  expect(result.moreBefore).toBe(`${firstRecordPosition},${firstRecordTime.getTime()}`);
  expect(result.moreAfter).toBe(`${lastRecordPosition},${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor ordered by empty string field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: `${CURSOR_NULL_PLACEHOLDER},1733654878079`,
          orderedBy: {
            descending: ['sandColor'],
          },
          limitedTo: 2,
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
        sandColor: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "sandColor" FROM "beaches" WHERE (("sandColor" IS NOT NULL) OR ("sandColor" IS NULL AND ("ronin.createdAt" > '2024-12-08T10:47:58.079Z'))) ORDER BY "sandColor" COLLATE NOCASE DESC, "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordTime = new Date('2024-12-10T10:47:58.079Z');
  const lastRecordTime = new Date('2024-12-09T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'bea_39h8fhe98hefah9j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Manly',
      sandColor: null,
    },
    {
      id: 'bea_39h8fhe98hefah0j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Coogee',
      sandColor: null,
    },
  ]);

  expect(result.moreBefore).toBe(
    `${CURSOR_NULL_PLACEHOLDER},${firstRecordTime.getTime()}`,
  );
  expect(result.moreAfter).toBe(`${CURSOR_NULL_PLACEHOLDER},${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor ordered by empty boolean field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: `${CURSOR_NULL_PLACEHOLDER},1733654878079`,
          orderedBy: {
            descending: ['swimmingAllowed'],
          },
          limitedTo: 2,
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
        swimmingAllowed: {
          type: 'boolean',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "swimmingAllowed" FROM "beaches" WHERE (("swimmingAllowed" IS NOT NULL) OR ("swimmingAllowed" IS NULL AND ("ronin.createdAt" > '2024-12-08T10:47:58.079Z'))) ORDER BY "swimmingAllowed" DESC, "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordSwimming: null = null;
  const firstRecordTime = new Date('2024-12-10T10:47:58.079Z');

  const lastRecordSwimming: null = null;
  const lastRecordTime = new Date('2024-12-09T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'bea_39h8fhe98hefah9j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Manly',
      swimmingAllowed: firstRecordSwimming,
    },
    {
      id: 'bea_39h8fhe98hefah0j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Coogee',
      swimmingAllowed: lastRecordSwimming,
    },
  ]);

  expect(result.moreBefore).toBe(`RONIN_NULL,${firstRecordTime.getTime()}`);
  expect(result.moreAfter).toBe(`RONIN_NULL,${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor ordered by empty number field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: `${CURSOR_NULL_PLACEHOLDER},1733654878079`,
          orderedBy: {
            descending: ['rating'],
          },
          limitedTo: 2,
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
        rating: {
          type: 'number',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "rating" FROM "beaches" WHERE (("rating" IS NOT NULL) OR ("rating" IS NULL AND ("ronin.createdAt" > '2024-12-08T10:47:58.079Z'))) ORDER BY "rating" DESC, "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordTime = new Date('2024-12-10T10:47:58.079Z');
  const lastRecordTime = new Date('2024-12-09T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'bea_39h8fhe98hefah9j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Manly',
      rating: null,
    },
    {
      id: 'bea_39h8fhe98hefah0j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Coogee',
      rating: null,
    },
  ]);

  expect(result.moreBefore).toBe(
    `${CURSOR_NULL_PLACEHOLDER},${firstRecordTime.getTime()}`,
  );
  expect(result.moreAfter).toBe(`${CURSOR_NULL_PLACEHOLDER},${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor while filtering', async () => {
  const queries: Array<Query> = [
    {
      get: {
        products: {
          before: '1733654878079',
          with: {
            name: {
              notBeing: null,
            },
          },
          limitedTo: 2,
        },
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "products" WHERE ("name" IS NOT NULL AND (("ronin.createdAt" > '2024-12-08T10:47:58.079Z'))) ORDER BY "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  const firstRecordTime = new Date('2024-12-10T10:47:58.079Z');
  const lastRecordTime = new Date('2024-12-09T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'pro_39h8fhe98hefah9j',
      ronin: {
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Banana',
    },
    {
      id: 'pro_39h8fhe98hefah0j',
      ronin: {
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Cherry',
    },
  ]);

  expect(result.moreBefore).toBe(firstRecordTime.getTime().toString());
  expect(result.moreAfter).toBe(lastRecordTime.getTime().toString());
});

test('get multiple records before undefined cursor', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: undefined,
          limitedTo: 2,
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
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" ORDER BY "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(result.records).toEqual([
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: expect.any(String),
    },
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: expect.any(String),
    },
  ]);
});

test('get multiple records after undefined cursor', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          after: undefined,
          limitedTo: 2,
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
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" ORDER BY "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as MultipleRecordResult;

  expect(result.records).toEqual([
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: expect.any(String),
    },
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: expect.any(String),
    },
  ]);
});

test('get multiple records before cursor without limit', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: '1667575193779',
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
    'When providing a pagination cursor in the `before` or `after` instruction, a `limitedTo` instruction must be provided as well, to define the page size.',
  );
  expect(error).toHaveProperty('code', 'MISSING_INSTRUCTION');
});

test('count multiple records before cursor without limit', async () => {
  const queries: Array<Query> = [
    {
      count: {
        accounts: {
          before: '1667575193779',
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
      sql: `SELECT (COUNT(*)) as "amount" FROM "accounts" WHERE (("ronin.createdAt" > '2022-11-04T15:19:53.779Z')) ORDER BY "ronin.createdAt" DESC`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as AmountResult;

  expect(result.amount).toBeNumber();
});
