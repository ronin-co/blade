import { describe, expect, spyOn, test } from 'bun:test';

import { queriesHandler } from '@/src/utils/handlers';

describe('queries handler', () => {
  test('derive the config from env if not expilicty passed down', async () => {
    const originalToken = import.meta.env.RONIN_TOKEN;
    const originalDatabase = import.meta.env.RONIN_ID;

    import.meta.env.RONIN_TOKEN = 'supertoken';
    import.meta.env.RONIN_ID = 'superdatabase';

    let mockToken: string | undefined;
    let mockDatabase: string | undefined;

    await queriesHandler([{ get: { accounts: null } }], {
      databaseCaller: (_statements, { token, database }) => {
        mockToken = token;
        mockDatabase = database;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    // Restore the original config.
    import.meta.env.RONIN_TOKEN = originalToken;
    import.meta.env.RONIN_ID = originalDatabase;

    expect(mockToken).toBe('supertoken');
    expect(mockDatabase).toBe('superdatabase');
  });

  test('run in an "process"-less environment', async () => {
    const env = process.env;
    const originalToken = import.meta.env.RONIN_TOKEN;
    const originalDatabase = import.meta.env.RONIN_ID;

    // @ts-expect-error We're intentionally modifying the runtime environment.
    process.env = undefined;
    import.meta.env.RONIN_TOKEN = 'mytoken';
    import.meta.env.RONIN_ID = 'mydatabase';

    let mockToken: string | undefined;
    let mockDatabase: string | undefined;

    await queriesHandler([{ get: { accounts: null } }], {
      databaseCaller: (_statements, { token, database }) => {
        mockToken = token;
        mockDatabase = database;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    // Restore original values.
    process.env = env;
    import.meta.env.RONIN_TOKEN = originalToken;
    import.meta.env.RONIN_ID = originalDatabase;

    expect(mockToken).toBe('mytoken');
    expect(mockDatabase).toBe('mydatabase');
  });

  test('correctly use the passed down config', async () => {
    let mockToken: string | undefined;
    let mockDatabase: string | undefined;

    await queriesHandler([{ get: { accounts: null } }], {
      token: 'takashitoken',
      database: 'takashidatabase',
      databaseCaller: (_statements, { token, database }) => {
        mockToken = token;
        mockDatabase = database;
        return { results: [[]] };
      },
      models: [{ slug: 'account' }],
    });

    expect(mockToken).toBe('takashitoken');
    expect(mockDatabase).toBe('takashidatabase');
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
