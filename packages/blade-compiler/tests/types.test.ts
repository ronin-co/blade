import { expect, test } from 'bun:test';
import {
  PAGINATION_CURSOR_REGEX,
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type {
  AmountResult,
  Result,
  ResultRecord,
  SingleRecordResult,
} from '@/src/types/result';

test('get single record', async () => {
  const queries: Array<Query> = [
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.id).toMatch(RECORD_ID_REGEX);
});

test('remove single record', async () => {
  const queries: Array<Query> = [
    {
      remove: {
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
        handle: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: 'DELETE FROM "accounts" WHERE "handle" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle"',
      params: ['elaine'],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });

  const result = results[0] as SingleRecordResult;

  expect(result.record?.id).toMatch(RECORD_ID_REGEX);
});

test('count multiple records', async () => {
  const queries: Array<Query> = [
    {
      count: {
        accounts: null,
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
      sql: `SELECT (COUNT(*)) as "amount" FROM "accounts"`,
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

test('pass multiple record queries at once', async () => {
  const queries: Array<Query> = [
    {
      count: {
        accounts: null,
      },
    },
    {
      get: {
        accounts: {
          selecting: ['handle'],
        },
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
      sql: 'SELECT (COUNT(*)) as "amount" FROM "accounts"',
      params: [],
      returning: true,
    },
    {
      sql: 'SELECT "handle" FROM "accounts"',
      params: [],
      returning: true,
    },
    {
      sql: 'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const results = transaction.formatResults(rawResults) as Array<
    Result<Partial<ResultRecord>>
  >;

  // Assert whether the results are provided in the same order as the original queries.
  expect(results).toEqual([
    {
      amount: 2,
    },
    {
      records: [
        {
          handle: 'elaine',
        },
        {
          handle: 'david',
        },
      ],
      modelFields: expect.objectContaining({
        id: 'string',
      }),
    },
    {
      record: {
        id: expect.stringMatching(RECORD_ID_REGEX),
        ronin: {
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
        handle: 'elaine',
      },
      modelFields: expect.objectContaining({
        id: 'string',
      }),
    },
  ]);
});

test('get all records of all models', async () => {
  const queries: Array<Query> = [
    {
      get: {
        all: null,
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'team',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"`,
      params: [],
      returning: true,
    },
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "teams"`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });
  const result = results[0];

  expect(result).toMatchObject({
    models: {
      accounts: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
      },
      teams: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
      },
    },
  });
});

test('get all records of all models with instructions', async () => {
  const queries: Array<Query> = [
    {
      get: {
        all: {
          limitedTo: 1,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'team',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts" ORDER BY "ronin.createdAt" DESC LIMIT 2`,
      params: [],
      returning: true,
    },
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "teams" ORDER BY "ronin.createdAt" DESC LIMIT 2`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });
  const result = results[0];

  expect(result).toMatchObject({
    models: {
      accounts: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
        moreAfter: expect.stringMatching(PAGINATION_CURSOR_REGEX),
      },
      teams: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
        moreAfter: expect.stringMatching(PAGINATION_CURSOR_REGEX),
      },
    },
  });
});

test('get all records of all models with model-specific instructions', async () => {
  const queries: Array<Query> = [
    {
      get: {
        all: {
          limitedTo: 1,
          on: {
            teams: {
              limitedTo: 10,
              // It is important to test an instruction here that is not already present
              // in the global instructions, to make sure it is working correctly.
              selecting: ['id'],
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
      slug: 'team',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts" ORDER BY "ronin.createdAt" DESC LIMIT 2`,
      params: [],
      returning: true,
    },
    {
      sql: `SELECT "id", "ronin.createdAt" FROM "teams" ORDER BY "ronin.createdAt" DESC LIMIT 11`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });
  const result = results[0];

  expect(result).toMatchObject({
    models: {
      accounts: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
        moreAfter: expect.stringMatching(PAGINATION_CURSOR_REGEX),
      },
      teams: {
        records: new Array(2).fill({
          id: expect.stringMatching(RECORD_ID_REGEX),
        }),
        modelFields: expect.objectContaining({
          id: 'string',
        }),
      },
    },
  });
});

test('get all records of linked models', async () => {
  const queries: Array<Query> = [
    {
      get: {
        all: {
          for: 'member',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'team',
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
    // These two should not end up in the final list of SQL statements. We are listing
    // them here to ensure that they are correctly filtered out.
    {
      slug: 'beach',
    },
    {
      slug: 'product',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"`,
      params: [],
      returning: true,
    },
    {
      sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "teams"`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });
  const result = results[0];

  expect(result).toMatchObject({
    models: {
      accounts: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
      },
      teams: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
      },
    },
  });
});

// Ensure that the query results are correctly grouped together.
test('get all records of linked models between other queries', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          limitedTo: 2,
        },
      },
    },
    {
      get: {
        all: {
          for: 'member',
        },
      },
    },
    {
      get: {
        products: {
          limitedTo: 2,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'team',
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
    {
      slug: 'beach',
    },
    {
      slug: 'product',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements[1]).toEqual({
    sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"`,
    params: [],
    returning: true,
  });

  expect(transaction.statements[2]).toEqual({
    sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "teams"`,
    params: [],
    returning: true,
  });

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[1];

  expect(result).toMatchObject({
    models: {
      accounts: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
      },
      teams: {
        records: [
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
          {
            id: expect.stringMatching(RECORD_ID_REGEX),
            ronin: {
              createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              createdBy: null,
              updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
              updatedBy: null,
            },
          },
        ],
        modelFields: expect.objectContaining({
          id: 'string',
        }),
      },
    },
  });
});

test('get all records of all models with no models available', async () => {
  const queries: Array<Query> = [
    {
      get: {
        all: null,
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });
  const result = results[0];

  expect(result).toMatchObject({
    models: {},
  });
});

test('count all records of all models', async () => {
  const queries: Array<Query> = [
    {
      count: {
        all: null,
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'beach',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      sql: `SELECT (COUNT(*)) as "amount" FROM "accounts"`,
      params: [],
      returning: true,
    },
    {
      sql: `SELECT (COUNT(*)) as "amount" FROM "beaches"`,
      params: [],
      returning: true,
    },
  ]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });
  const result = results[0];

  expect(result).toMatchObject({
    models: {
      accounts: {
        amount: 2,
      },
      beaches: {
        amount: 4,
      },
    },
  });
});

test('count all records of all models with no models available', async () => {
  const queries: Array<Query> = [
    {
      count: {
        all: null,
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([]);

  const results = await transaction.formatResults(async (statements) => {
    const results = await queryEphemeralDatabase(models, statements);
    return { results, raw: false };
  });
  const result = results[0];

  expect(result).toMatchObject({
    models: {},
  });
});
