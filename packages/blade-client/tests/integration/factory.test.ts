import { describe, expect, mock, test } from 'bun:test';
import type { Statement } from 'blade-compiler';
import type { ResultRecord } from 'blade-syntax/queries';

import { createSyntaxFactory } from '@/src/index';
import type { StorableObject } from '@/src/types/storage';

describe('factory', () => {
  test('can use the custom database caller', async () => {
    const mockDatabaseCaller = mock(() => ({ results: [[]] }));

    const factory = createSyntaxFactory({
      databaseCaller: mockDatabaseCaller,
      models: [{ slug: 'account' }],
      token: 'takashitoken',
      database: 'takashidatabase',
    });

    await factory.get.accounts();

    expect(mockDatabaseCaller).toHaveBeenCalledWith(
      [
        {
          sql: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"`,
          params: [],
          returning: true,
        },
      ],
      { token: 'takashitoken', database: 'takashidatabase', stream: false },
    );
  });

  test('run correct statements for single `get` query', async () => {
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    await factory.get.accounts();

    expect(mockStatements?.[0]?.sql).toBe(
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"',
    );
  });

  test('run correct statements for consecutive mixed queries', async () => {
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'space',
          fields: { createdAt: { type: 'date' }, memberCount: { type: 'number' } },
        },
        {
          slug: 'account',
          fields: { emailVerified: { type: 'boolean' } },
        },
      ],
    });

    await factory.get.spaces.with({
      createdAt: { lessThan: new Date('2024-04-16T15:02:12.710Z') },
    });

    expect(mockStatements?.[0]?.sql).toBe(
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "createdAt", "memberCount" FROM "spaces" WHERE "createdAt" < ?1',
    );

    await factory.remove.accounts.with({
      emailVerified: { being: false },
    });

    expect(mockStatements?.[0]?.sql).toBe(
      'DELETE FROM "accounts" WHERE "emailVerified" = ?1 RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "emailVerified"',
    );
  });

  test('run correct statements for `get` only `batch`', async () => {
    let mockStatements: Array<Statement> = [];

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[], [], [], [], []] };
      },
      models: [
        { slug: 'account' },
        { slug: 'member', fields: { handle: { type: 'string' } } },
        { slug: 'space' },
      ],
    });

    await factory.batch(() => [
      factory.get.accounts(),
      factory.get.members.with.handle('ronin'),
      factory.get.members.limitedTo(100),
      factory.get.spaces.orderedBy.descending(['ronin.createdAt']),
      factory.get.member.with.id('123'),
    ]);

    expect(mockStatements.map((item) => item.sql)).toEqual([
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts"',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "members" WHERE "handle" = ?1',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "members" ORDER BY "ronin.createdAt" DESC LIMIT 101',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "spaces" ORDER BY "ronin.createdAt" DESC',
      'SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "members" WHERE "id" = ?1 LIMIT 1',
    ]);
  });

  test('make sure `batch` extracts queries synchronously', async () => {
    const mockStatements: Array<Array<Statement>> = [];

    const factory = createSyntaxFactory({
      databaseCaller: (statements) => {
        mockStatements.push(statements);

        if (statements[0].sql.startsWith('DELETE')) {
          return { results: [[], []] };
        }

        return { results: [[]] };
      },
      models: [
        { slug: 'account' },
        { slug: 'space' },
        { slug: 'member' },
        { slug: 'user' },
      ],
    });

    // If `batch` does not extract queries synchronously, the following
    // `get` requests will be triggered while the `batch` is still being
    // processed and that in turn will make the `get` requests act like they
    // are in a batch.
    (await Promise.all([
      factory.batch(() => [factory.remove.accounts(), factory.remove.spaces()]),
      factory.get.members(),
      factory.get.users(),
    ])) as any;

    expect(mockStatements).toHaveLength(3);
    expect(mockStatements[0]).toHaveLength(2);
  });

  test('correctly format `amount`', async () => {
    const factory = createSyntaxFactory({
      databaseCaller: () => ({
        results: [
          [
            {
              amount: 10,
            },
          ],
        ],
      }),
      models: [
        {
          slug: 'account',
        },
      ],
    });

    const result = await factory.count.accounts();

    expect(result).toBe(10);
  });

  test('correctly format not found result', async () => {
    const factory = createSyntaxFactory({
      databaseCaller: () => ({
        results: [[]],
      }),
      models: [
        {
          slug: 'account',
        },
      ],
    });

    const result = await factory.get.account();

    expect(result).toBeNull();
  });

  test('upload image', async () => {
    const bunFile = Bun.file('tests/assets/example.jpeg');
    const file = new File([new Uint8Array(await bunFile.arrayBuffer())], 'example.jpeg', {
      type: 'image/jpeg',
    });

    let mockStorableObject: StorableObject | undefined;
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      storageCaller: (object) => {
        mockStorableObject = object;

        return {
          key: 'test-key',
          name: 'example.jpeg',
          src: 'https://storage.ronin.co/test-key',
          meta: {
            height: 100,
            width: 100,
            size: 100,
            type: 'image/jpeg',
          },
          placeholder: {
            base64: '',
          },
        };
      },
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'account',
          fields: { avatar: { type: 'blob' } },
        },
      ],
    });

    await factory.add.account.with.avatar(file);

    expect(mockStorableObject?.contentType).toBe('image/jpeg');

    expect(mockStorableObject?.name).toBe('example.jpeg');
    expect(mockStorableObject?.value).toBe(file);

    expect(mockStatements?.[0]?.sql).toBe(
      'INSERT INTO "accounts" ("avatar", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "avatar"',
    );
    expect(mockStatements?.[0]?.params[0]).toBe(
      '{"key":"test-key","name":"example.jpeg","src":"https://storage.ronin.co/test-key","meta":{"height":100,"width":100,"size":100,"type":"image/jpeg"},"placeholder":{"base64":""}}',
    );
  });

  test('upload video', async () => {
    const bunFile = Bun.file('tests/assets/example.mp4');
    const file = new File([new Uint8Array(await bunFile.arrayBuffer())], 'example.mp4', {
      type: 'video/mp4',
    });

    let mockStorableObject: StorableObject | undefined;
    let mockStatements: Array<Statement> | undefined;

    const factory = createSyntaxFactory({
      storageCaller: (object) => {
        mockStorableObject = object;

        return {
          key: 'test-key',
          name: 'example.mp4',
          src: 'https://storage.ronin.co/test-key',
          meta: {
            size: 100,
            type: 'video/mp4',
          },
          placeholder: null,
        };
      },
      databaseCaller: (statements) => {
        mockStatements = statements;
        return { results: [[]] };
      },
      models: [
        {
          slug: 'account',
          fields: { video: { type: 'blob' } },
        },
      ],
    });

    await factory.add.account.with.video(file);

    expect(mockStorableObject?.contentType).toBe('video/mp4');

    expect(mockStorableObject?.name).toBe('example.mp4');
    expect(mockStorableObject?.value).toBe(file);

    expect(mockStatements?.[0]?.sql).toBe(
      'INSERT INTO "accounts" ("video", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "video"',
    );
    expect(mockStatements?.[0]?.params[0]).toBe(
      '{"key":"test-key","name":"example.mp4","src":"https://storage.ronin.co/test-key","meta":{"size":100,"type":"video/mp4"},"placeholder":null}',
    );
  });

  test('format date fields', async () => {
    const factory = createSyntaxFactory({
      databaseCaller: () => ({
        results: [
          [
            {
              id: '1',
              'ronin.createdAt': '2024-04-16T15:02:12.710Z',
              'ronin.createdBy': '1234',
              'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
              'ronin.updatedBy': '1234',
              name: 'Tim',
              joinedAt: '2024-04-16T15:02:12.710Z',
            },
          ],

          [
            {
              id: '1',
              'ronin.createdAt': '2024-04-16T15:02:12.710Z',
              'ronin.createdBy': '1234',
              'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
              'ronin.updatedBy': '1234',
              name: 'Leo',
              joinedAt: '2024-04-16T15:02:12.710Z',
            },
            {
              id: '2',
              'ronin.createdAt': '2024-04-16T15:02:12.710Z',
              'ronin.createdBy': '1234',
              'ronin.updatedAt': '2024-04-16T15:02:12.710Z',
              'ronin.updatedBy': '1234',
              name: 'Juri',
              joinedAt: '2024-04-16T15:02:12.710Z',
            },
          ],
        ],
      }),
      models: [
        {
          slug: 'account',
          fields: { name: { type: 'string' }, joinedAt: { type: 'date' } },
        },
      ],
    });

    const [account, accounts] = await factory.batch(() => [
      factory.get.account<{
        name: string;
        joinedAt: Date;
        ronin: ResultRecord['ronin'];
      }>(),
      factory.get.accounts(),
    ]);

    expect(account.joinedAt).toBeInstanceOf(Date);
    expect(account.ronin.createdAt).toBeInstanceOf(Date);

    expect(account.joinedAt.toISOString()).toBe('2024-04-16T15:02:12.710Z');
    expect(account.ronin.updatedAt.toISOString()).toBe('2024-04-16T15:02:12.710Z');

    expect(accounts[0].joinedAt).toBeInstanceOf(Date);
    expect(accounts[0].ronin.updatedAt).toBeInstanceOf(Date);

    expect(accounts[0].joinedAt.toISOString()).toBe('2024-04-16T15:02:12.710Z');
    expect(accounts[0].ronin.updatedAt.toISOString()).toBe('2024-04-16T15:02:12.710Z');
  });
});
