import { describe, expect, spyOn, test } from 'bun:test';

import createSyntaxFactory from '@/src/index';
import { runQueriesWithTriggers } from '@/src/triggers';

describe('edge runtime', () => {
  test('invoke from an edge runtime without passing a token', async () => {
    let error: Error | undefined;

    // Simulate a web runtime.
    const oldProcess = global.process;
    global.process = undefined as unknown as NodeJS.Process;

    const oldImportMeta = import.meta.env.RONIN_TOKEN;
    import.meta.env.RONIN_TOKEN = undefined;

    try {
      const factory = createSyntaxFactory({});

      await factory.get.account();
    } catch (err) {
      error = err as Error;
    }

    // Restore the old runtime.
    global.process = oldProcess;
    import.meta.env.RONIN_TOKEN = oldImportMeta;

    expect(error?.message).toMatch(
      'When invoking RONIN from an edge runtime, the `token` option must be set.',
    );
  });

  test('invoke from an edge runtime without `waitUntil` set', async () => {
    let error: Error | undefined;

    // Simulate a web runtime.
    const oldProcess = global.process;
    global.process = undefined as unknown as NodeJS.Process;

    try {
      const factory = createSyntaxFactory({
        token: 'supertoken',
        triggers: {
          // @ts-expect-error - We are deliberately causing an error.
          add: () => undefined,
        },
      });

      await factory.add.account({ with: { handle: 'leo' } });
    } catch (err) {
      error = err as Error;
    }

    // Restore the old runtime.
    global.process = oldProcess;

    expect(error?.message).toMatch(
      `In the case that the "blade-client" package receives a value for its \`triggers\` option, it must also receive a value for its \`waitUntil\` option. This requirement only applies when using an edge runtime and ensures that the edge worker continues to execute until all "following" triggers have been executed.`,
    );
  });

  test('invoke from an edge runtime with `waitUntil` set', async () => {
    const queries = [
      {
        add: { account: { with: { handle: 'leo' } } },
      },
    ];

    const triggerInvocation = { happened: () => true };
    const triggerInvocationHappened = spyOn(triggerInvocation, 'happened');

    const promisesToAwait: Array<Promise<unknown>> = [];

    // Simulate a web runtime.
    const oldProcess = global.process;
    global.process = undefined as unknown as NodeJS.Process;

    await runQueriesWithTriggers(
      queries.map((query) => ({ query })),
      {
        databaseCaller: () => ({
          results: [
            [
              {
                id: '1',
                handle: 'leo',
                firstName: 'Leo',
                lastName: 'Lamprecht',
              },
            ],
          ],
        }),
        models: [
          {
            slug: 'account',
            fields: { handle: { type: 'string' } },
          },
        ],
        triggers: {
          account: {
            followingAdd: async () => {
              // Sleep for 50 milliseconds to simulate an asynchronous action.
              await new Promise((resolve) => setTimeout(resolve, 50));

              triggerInvocation.happened();
            },
          },
        },
        waitUntil: (promise) => {
          promisesToAwait.push(promise);
        },
        token: 'supertoken',
      },
    );

    // Restore the old runtime.
    global.process = oldProcess;

    expect(promisesToAwait.length).toBeGreaterThan(0);

    // Wait for asynchronous "following" triggers to finish.
    expect(triggerInvocationHappened).not.toHaveBeenCalled();
    await Promise.all(promisesToAwait);
    expect(triggerInvocationHappened).toHaveBeenCalled();
  });

  test('invoke from an edge runtime with `waitUntil` set and error being thrown', async () => {
    const queries = [
      {
        add: { account: { with: { handle: 'leo' } } },
      },
    ];

    const errorText = 'I am an error';
    const promisesToAwait: Array<Promise<unknown>> = [];

    // Simulate a web runtime.
    const oldProcess = global.process;
    global.process = undefined as unknown as NodeJS.Process;

    await runQueriesWithTriggers(
      queries.map((query) => ({ query })),
      {
        fetch: async () => {
          return Response.json({
            results: [
              {
                record: {
                  id: '1',
                  handle: 'leo',
                  firstName: 'Leo',
                  lastName: 'Lamprecht',
                },
              },
            ],
          });
        },
        triggers: {
          account: {
            followingAdd: () => {
              throw new Error(errorText);
            },
          },
        },
        waitUntil: (promise) => {
          promisesToAwait.push(promise);
        },
        token: 'supertoken',
      },
    );

    // Restore the old runtime.
    global.process = oldProcess;

    // Wait for asynchronous "following" triggers to finish.
    expect(promisesToAwait[0]).rejects.toThrow(errorText);
  });

  test('invoke from an edge runtime with `waitUntil` set and ensure hidden result', async () => {
    const queries = [
      {
        add: { account: { with: { handle: 'leo' } } },
      },
    ];

    const promisesToAwait: Array<Promise<unknown>> = [];

    // Simulate a web runtime.
    const oldProcess = global.process;
    global.process = undefined as unknown as NodeJS.Process;

    await runQueriesWithTriggers(
      queries.map((query) => ({ query })),
      {
        fetch: async () => {
          return Response.json({
            results: [
              {
                record: {
                  id: '1',
                  handle: 'leo',
                  firstName: 'Leo',
                  lastName: 'Lamprecht',
                },
              },
            ],
          });
        },
        triggers: {
          account: {
            followingAdd: async () => {
              // Sleep for 50 milliseconds to simulate an asynchronous action.
              await new Promise((resolve) => setTimeout(resolve, 50));
            },
          },
        },
        waitUntil: (promise) => {
          promisesToAwait.push(promise);
        },
        token: 'supertoken',
      },
    );

    // Restore the old runtime.
    global.process = oldProcess;

    // Wait for asynchronous "following" triggers to finish.
    const result = await Promise.all(promisesToAwait);

    // Ensure that the internal results of the trigger run are not being exposed.
    // In other words, the promises handed to `waitUntil` must not resolve with
    // any value, since their purpose is to run asynchronous "following" triggers.
    expect(result).toMatchObject([undefined]);
  });
});
