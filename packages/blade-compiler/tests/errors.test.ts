import { expect, test } from 'bun:test';
import { CompilerError, type Model, type Query, Transaction } from '@/src/index';

test('get single record with non-existing field', () => {
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
    'Field "handle" defined for `with` does not exist in model "Account".',
  );
  expect(error).toHaveProperty('code', 'FIELD_NOT_FOUND');
});

test('get single record with non-existing model', () => {
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

test('get single record with empty `with` instruction', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {},
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

  let error: Error | undefined;

  try {
    new Transaction(queries, { models });
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(CompilerError);
  expect(error).toHaveProperty(
    'message',
    'The `with` instruction must not contain an empty field. The following fields are empty: `handle`. If you meant to query by an empty field, try using `null` instead.',
  );
  expect(error).toHaveProperty('code', 'INVALID_WITH_VALUE');
});

test('set single record with empty `to` instruction', () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {},
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
    'When using a `set` query, the `to` instruction must be a non-empty object.',
  );
  expect(error).toHaveProperty('code', 'INVALID_TO_VALUE');
});

test('add single record with empty `with` instruction', () => {
  const queries: Array<Query> = [
    {
      add: {
        account: {
          with: {},
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
    'When using a `add` query, the `with` instruction must be a non-empty object.',
  );
  expect(error).toHaveProperty('code', 'INVALID_WITH_VALUE');
});

test('get single record with `before` instruction', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
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
    'The `before` and `after` instructions are not supported when querying for a single record.',
  );
  expect(error).toHaveProperty('code', 'INVALID_BEFORE_OR_AFTER_INSTRUCTION');
});

test('get single record with `after` instruction', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          after: '1667575193779',
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
    'The `before` and `after` instructions are not supported when querying for a single record.',
  );
  expect(error).toHaveProperty('code', 'INVALID_BEFORE_OR_AFTER_INSTRUCTION');
});

test('get multiple records with `before` and `after` instruction', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: '1267575193779',
          after: '1467575193779',
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
    'The `before` and `after` instructions cannot co-exist. Choose one.',
  );
  expect(error).toHaveProperty('code', 'MUTUALLY_EXCLUSIVE_INSTRUCTIONS');
});

test('get multiple records with empty `before` instruction', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: '',
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
    'The `before` or `after` instruction must not be empty.',
  );
  expect(error).toHaveProperty('code', 'MISSING_INSTRUCTION');
});
