import { describe, expect, spyOn, test } from 'bun:test';

import { queriesHandler } from '@/src/utils/handlers';

describe('queries handler', () => {
  test('throw if called without token', () => {
    const originalToken = import.meta.env.RONIN_TOKEN;

    import.meta.env.RONIN_TOKEN = undefined;

    expect(queriesHandler.bind({}, [], {})).toThrow(
      'Please specify the `RONIN_TOKEN` environment variable.',
    );

    // Restore the original token.
    import.meta.env.RONIN_TOKEN = originalToken;
  });

  test('throw if called without database', () => {
    const originalDatabase = import.meta.env.RONIN_ID;

    import.meta.env.RONIN_ID = undefined;

    expect(queriesHandler.bind({}, [], {})).toThrow(
      'Please specify the `RONIN_ID` environment variable.',
    );

    // Restore the original token.
    import.meta.env.RONIN_ID = originalDatabase;
  });

  test('derive the token from env if not expilicty passed down', async () => {
    const originalToken = import.meta.env.RONIN_TOKEN;

    import.meta.env.RONIN_TOKEN = 'supertoken';

    let mockToken: string | undefined;

    await queriesHandler([{ get: { accounts: null } }], {
      databaseCaller: (_statements, { token }) => {
        mockToken = token;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    // Restore the original token.
    import.meta.env.RONIN_TOKEN = originalToken;

    expect(mockToken).toBe('supertoken');
  });

  test('run in an "process"-less environment', async () => {
    const env = process.env;
    const originalToken = import.meta.env.RONIN_TOKEN;

    // @ts-expect-error We're intentionally modifying the runtime environment.
    process.env = undefined;
    import.meta.env.RONIN_TOKEN = 'mytoken';

    let mockToken: string | undefined;

    await queriesHandler([{ get: { accounts: null } }], {
      databaseCaller: (_statements, { token }) => {
        mockToken = token;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    // Restore original values.
    process.env = env;
    import.meta.env.RONIN_TOKEN = originalToken;

    expect(mockToken).toBe('mytoken');
  });

  test('correctly use the passed down token', async () => {
    let mockToken: string | undefined;

    await queriesHandler([{ get: { accounts: null } }], {
      token: 'takashitoken',
      databaseCaller: (_statements, { token }) => {
        mockToken = token;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    expect(mockToken).toBe('takashitoken');
  });

  test('enable verbose logging', async () => {
    const currentConsoleLog = console.log;
    const logSpy = spyOn(console, 'log').mockImplementation(currentConsoleLog);

    await queriesHandler([{ get: { accounts: null } }], {
      databaseCaller: () => ({ results: [[]] }),
      models: [{ slug: 'account' }],
    });

    // Make sure that no logs were printed without the verbose flag.
    expect(logSpy).not.toHaveBeenCalled();

    await queriesHandler([{ get: { accounts: null } }], {
      databaseCaller: () => ({ results: [[]] }),
      models: [{ slug: 'account' }],
      debug: true,
    });

    // Make sure that the logs were printed with the verbose flag.
    expect(logSpy).toHaveBeenCalled();

    // Restore the global console.log() function.
    logSpy.mockRestore();
  });
});
