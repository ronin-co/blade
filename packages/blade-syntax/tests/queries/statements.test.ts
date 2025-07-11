import { describe, expect, spyOn, test } from 'bun:test';
import { getBatchProxySQL, getSyntaxProxySQL } from '@/src/queries';
import type { Statement } from 'blade-compiler';
import { expectTypeOf } from 'expect-type';

test('using raw SQL', async () => {
  let statement: Statement | undefined;

  const sqlProxy = getSyntaxProxySQL({
    callback: (value) => {
      statement = value;
    },
  });

  const accountHandle = 'elaine';
  sqlProxy`SELECT * FROM accounts WHERE handle = ${accountHandle}`;

  expect(statement).toMatchObject({
    statement: 'SELECT * FROM accounts WHERE handle = $1',
    params: ['elaine'],
  });
});

test('using raw SQL in batch', async () => {
  const statementHandler = { callback: () => undefined };
  const statementHandlerSpy = spyOn(statementHandler, 'callback');

  const sqlProxy = getSyntaxProxySQL({
    callback: statementHandlerSpy,
  });

  const accountHandle = 'elaine';

  const batchProxy = getBatchProxySQL(() => [
    sqlProxy`SELECT * FROM accounts WHERE handle = ${accountHandle}`,
  ]);

  expect(batchProxy).toMatchObject([
    {
      statement: 'SELECT * FROM accounts WHERE handle = $1',
      params: ['elaine'],
    },
  ]);

  expectTypeOf(batchProxy).toEqualTypeOf<Array<Statement>>();

  expect(statementHandlerSpy).not.toHaveBeenCalled();
});

test('using raw SQL with multiple lines', async () => {
  let statement: Statement | undefined;

  const sqlProxy = getSyntaxProxySQL({
    callback: (value) => {
      statement = value;
    },
  });

  const accountHandle = 'elaine';

  sqlProxy`
    UPDATE accounts
    SET "points" = 11
    WHERE "handle" = ${accountHandle}
    RETURNING *
  `;

  expect(statement).toMatchObject({
    statement: 'UPDATE accounts SET "points" = 11 WHERE "handle" = $1 RETURNING *',
    params: ['elaine'],
  });
});

describe('using raw SQL with comments', () => {
  test('--', async () => {
    let statement: Statement | undefined;

    const sqlProxy = getSyntaxProxySQL({
      callback: (value) => {
        statement = value;
      },
    });

    const accountHandle = 'elaine';
    sqlProxy`
      -- Select all accounts with the given handle:
      SELECT * FROM accounts WHERE handle = ${accountHandle}
    `;

    expect(statement).toMatchObject({
      statement: 'SELECT * FROM accounts WHERE handle = $1',
      params: ['elaine'],
    });
  });

  test('/* ... */', async () => {
    let statement: Statement | undefined;

    const sqlProxy = getSyntaxProxySQL({
      callback: (value) => {
        statement = value;
      },
    });

    const accountHandle = 'elaine';
    sqlProxy`
      /* Select all accounts with the given handle */
      SELECT * FROM accounts WHERE handle = ${accountHandle}
    `;

    expect(statement).toMatchObject({
      statement: 'SELECT * FROM accounts WHERE handle = $1',
      params: ['elaine'],
    });
  });
});
