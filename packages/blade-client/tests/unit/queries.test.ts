import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { runQueriesWithStorageAndTriggers } from '@/src/queries';
import { queriesHandler } from '@/src/utils/handlers';
import type { Query } from 'blade-compiler';

let mockRequestResolvedValue: Request | undefined;

const mockFetch = mock(
  // biome-ignore lint/suspicious/useAwait: `fetch` requires a promise return.
  async (request) => {
    mockRequestResolvedValue = request;

    return Response.json({
      results: [],
    });
  },
);

global.fetch = mockFetch;

describe('queries handler', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('throw if called without token', () => {
    const originalToken = import.meta.env.RONIN_TOKEN;

    import.meta.env.RONIN_TOKEN = undefined;

    expect(queriesHandler.bind({}, [], {})).toThrow(
      'Please specify the `RONIN_TOKEN` environment variable or set the `token` option when invoking RONIN.',
    );

    // Restore the original token.
    import.meta.env.RONIN_TOKEN = originalToken;
  });

  test('derive the token from env if not expilicty passed down', async () => {
    const originalToken = import.meta.env.RONIN_TOKEN;

    import.meta.env.RONIN_TOKEN = 'supertoken';

    await queriesHandler([], {});

    // Restore the original token.
    import.meta.env.RONIN_TOKEN = originalToken;

    expect(mockRequestResolvedValue?.headers.get('Authorization')).toBe(
      'Bearer supertoken',
    );
  });

  test('run in an "process"-less environment', async () => {
    const env = process.env;
    const originalToken = import.meta.env.RONIN_TOKEN;

    // @ts-expect-error We're intentionally modifying the runtime environment.
    process.env = undefined;
    import.meta.env.RONIN_TOKEN = 'mytoken';

    await queriesHandler([], {});

    // Restore original values.
    process.env = env;
    import.meta.env.RONIN_TOKEN = originalToken;

    expect(mockRequestResolvedValue?.headers.get('Authorization')).toBe('Bearer mytoken');
  });

  test('correctly use the passed down token', async () => {
    await queriesHandler([], { token: 'takashitoken' });

    expect(mockRequestResolvedValue?.headers.get('Authorization')).toBe(
      'Bearer takashitoken',
    );
  });

  test('use the custom fetcher', async () => {
    const mockFetchNew = mock((request) => {
      mockRequestResolvedValue = request;

      return Response.json({
        results: [],
      });
    });

    await queriesHandler([], {
      fetch: async (request) => mockFetchNew(request),
      token: 'takashitoken',
    });

    expect(mockFetchNew).toHaveBeenCalledTimes(1);
    expect(mockRequestResolvedValue?.headers.get('Authorization')).toBe(
      'Bearer takashitoken',
    );
  });

  test('handle BAD_REQUEST response', async () => {
    const requestPromise = queriesHandler([], {
      token: 'takashitoken',
      // biome-ignore lint/suspicious/useAwait: `fetch` requires a promise return.
      fetch: async (request) => {
        mockRequestResolvedValue = request as Request;

        return new Response(
          JSON.stringify({
            results: [],
            error: {
              message: 'Invalid query provided.',
              code: 'BAD_REQUEST',
            },
          }),
          {
            status: 400,
          },
        );
      },
    });

    expect(requestPromise).rejects.toThrow('Invalid query provided.');
  });

  test('enable verbose logging', async () => {
    const currentConsoleLog = console.log;
    const logSpy = spyOn(console, 'log').mockImplementation(currentConsoleLog);

    await queriesHandler([]);

    // Make sure that no logs were printed without the verbose flag.
    expect(logSpy).not.toHaveBeenCalled();

    const originalDebugLevel = import.meta.env.__RENDER_DEBUG_LEVEL;
    import.meta.env.__RENDER_DEBUG_LEVEL = 'verbose';

    await queriesHandler([]);

    import.meta.env.__RENDER_DEBUG_LEVEL = originalDebugLevel;

    // Make sure that the logs were printed with the verbose flag.
    expect(logSpy).toHaveBeenCalled();

    // Restore the global console.log() function.
    logSpy.mockRestore();
  });

  test('accessing multiple databases at once', async () => {
    const currentTime = new Date();

    const mockFetchNew = mock((request) => {
      mockRequestResolvedValue = request;

      return Response.json({
        default: {
          results: [
            {
              record: {
                handle: 'elaine',
              },
              modelFields: {
                handle: 'string',
              },
            },
            {
              record: {
                name: 'Engineering',
              },
              modelFields: {
                name: 'string',
              },
            },
          ],
        },
        secondary: {
          results: [
            {
              record: {
                name: 'MacBook Pro',
                releasedAt: currentTime.toISOString(),
              },
              modelFields: {
                name: 'string',
                releasedAt: 'date',
              },
            },
          ],
        },
      });
    });

    const defaultQueries: Array<Query> = [
      {
        get: {
          account: null,
        },
      },
      {
        get: {
          team: null,
        },
      },
    ];

    const secondaryQueries: Array<Query> = [
      {
        get: {
          product: null,
        },
      },
    ];

    const results = await runQueriesWithStorageAndTriggers(
      {
        default: defaultQueries,
        secondary: secondaryQueries,
      },
      {
        fetch: async (request) => mockFetchNew(request),
        token: 'takashitoken',
      },
    );

    expect(await mockRequestResolvedValue?.text()).toEqual(
      JSON.stringify({
        default: {
          queries: defaultQueries,
        },
        secondary: {
          queries: secondaryQueries,
        },
      }),
    );

    expect(results).toMatchObject({
      default: [
        {
          handle: 'elaine',
        },
        {
          name: 'Engineering',
        },
      ],
      secondary: [
        {
          name: 'MacBook Pro',
          releasedAt: currentTime,
        },
      ],
    });
  });
});
