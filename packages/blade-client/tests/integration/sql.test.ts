import { expect, mock, test } from 'bun:test';
import createSyntaxFactory from '@/src/index';

test('run SQL statements', async () => {
  let mockRequestResolvedValue: Request | undefined;

  const records = [
    {
      id: 'acc_39h8fhe98hefah8j',
      'ronin.createdAt': '2024-12-11T10:47:58.079Z',
      'ronin.updatedAt': '2024-12-11T10:47:58.079Z',
      'ronin.createdBy': 'acc_39h8fhe98hefah8j',
      'ronin.updatedBy': 'acc_39h8fhe98hefah8j',
      handle: 'elaine',
      email: 'elaine@site.co',
      firstName: 'Elaine',
      lastName: 'Jones',
      avatar:
        '{"key":"test-key","name":"example.png","src":"https://storage.ronin.co/test-key","meta":{"height": 100,"width": 100,"size": 100,"type": "image/png"},"placeholder":{"base64":""}}',
    },
  ];

  const mockFetchNew = mock((request) => {
    mockRequestResolvedValue = request;

    return Response.json({
      results: [
        {
          records,
        },
      ],
    });
  });

  const factory = createSyntaxFactory({
    fetch: async (request) => mockFetchNew(request),
    token: 'takashitoken',
  });

  const accountHandle = 'elaine';
  const results =
    await factory.sql`SELECT * FROM accounts WHERE handle = ${accountHandle}`;

  expect(mockFetchNew).toHaveBeenCalledTimes(1);
  expect(await mockRequestResolvedValue?.text()).toEqual(
    '{"nativeQueries":[{"query":"SELECT * FROM accounts WHERE handle = $1","values":["elaine"]}]}',
  );

  expect(results).toMatchObject(records);
});

test('run SQL statements in batch', async () => {
  let mockRequestResolvedValue: Request | undefined;

  const records = [
    {
      id: 'acc_39h8fhe98hefah8j',
      'ronin.createdAt': '2024-12-11T10:47:58.079Z',
      'ronin.updatedAt': '2024-12-11T10:47:58.079Z',
      'ronin.createdBy': 'acc_39h8fhe98hefah8j',
      'ronin.updatedBy': 'acc_39h8fhe98hefah8j',
      handle: 'elaine',
      email: 'elaine@site.co',
      firstName: 'Elaine',
      lastName: 'Jones',
      avatar:
        '{"key":"test-key","name":"example.png","src":"https://storage.ronin.co/test-key","meta":{"height": 100,"width": 100,"size": 100,"type": "image/png"},"placeholder":{"base64":""}}',
    },
  ];

  const mockFetchNew = mock((request) => {
    mockRequestResolvedValue = request;

    return Response.json({
      results: [
        {
          records,
        },
      ],
    });
  });

  const factory = createSyntaxFactory({
    fetch: async (request) => mockFetchNew(request),
    token: 'takashitoken',
  });

  const accountHandle = 'elaine';
  const results = await factory.sqlBatch(() => [
    factory.sql`SELECT * FROM accounts WHERE handle = ${accountHandle}`,
  ]);

  expect(mockFetchNew).toHaveBeenCalledTimes(1);
  expect(await mockRequestResolvedValue?.text()).toEqual(
    '{"nativeQueries":[{"query":"SELECT * FROM accounts WHERE handle = $1","values":["elaine"]}]}',
  );

  expect(results).toMatchObject([records]);
});
