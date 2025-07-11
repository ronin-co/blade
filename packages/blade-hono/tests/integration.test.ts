import { describe, expect, it } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createFactory } from 'hono/factory';
import { testClient } from 'hono/testing';

import { ronin } from '@/src/index';
import { fetcher } from '@/tests/utils';

import type { Bindings, Variables } from '@/src/index';

import.meta.env.RONIN_TOKEN = 'secret-token';

describe('Use `ronin` middleware', () => {
  const factory = createFactory<{ Bindings: Bindings; Variables: Variables }>();

  it('with default options', async () => {
    const app = factory
      .createApp()
      .use('*', ronin({ fetch: fetcher }))
      .get('/', async (c) => {
        expect(c.var.ronin).toBeDefined();

        const users = await c.var.ronin.get.users();

        expect(users).toBeDefined();
        expect(users).toBeInstanceOf(Array);

        return c.json(users);
      });

    const response = await testClient(app, {
      RONIN_TOKEN: import.meta.env.RONIN_TOKEN,
    }).index.$get();

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const json = await response.json();

    expect(json).toBeDefined();
    expect(json).toBeInstanceOf(Array);
    expect(json).toHaveLength(0);
  });

  it('with custom options (object)', async () => {
    const app = factory
      .createApp()
      .use(
        '*',
        ronin({
          fetch: fetcher,
          triggers: {
            user: {
              get: (query) => {
                query.limitedTo = 1;
                return query;
              },
            },
          },
        }),
      )
      .get('/', async (c) => {
        expect(c.var.ronin).toBeDefined();

        const users = await c.var.ronin.get.users();

        expect(users).toBeDefined();
        expect(users).toBeInstanceOf(Array);

        return c.json(users);
      });

    const response = await testClient(app, {
      RONIN_TOKEN: import.meta.env.RONIN_TOKEN,
    }).index.$get();

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const json = await response.json();

    expect(json).toBeDefined();
    expect(json).toBeInstanceOf(Array);
    expect(json).toHaveLength(1);
  });

  it('with custom options (function)', async () => {
    const app = factory
      .createApp()
      .use(
        '*',
        ronin(() => ({
          fetch: fetcher,
          triggers: {
            user: {
              get: (query) => {
                query.limitedTo = 1;
                return query;
              },
            },
          },
        })),
      )
      .get('/', async (c) => {
        expect(c.var.ronin).toBeDefined();

        const users = await c.var.ronin.get.users();

        expect(users).toBeDefined();
        expect(users).toBeInstanceOf(Array);

        return c.json(users);
      });

    const response = await testClient(app, {
      RONIN_TOKEN: import.meta.env.RONIN_TOKEN,
    }).index.$get();

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const json = await response.json();

    expect(json).toBeDefined();
    expect(json).toBeInstanceOf(Array);
    expect(json).toHaveLength(1);
  });

  it('with custom options using the Hono context (function)', async () => {
    const app = factory
      .createApp()
      .use(
        '*',
        ronin((context) => {
          expect(context).toBeDefined();
          expect(context.env).toMatchObject({});

          return {
            fetch: fetcher,
            triggers: {
              user: {
                get: (query) => {
                  query.limitedTo = 1;
                  return query;
                },
              },
            },
          };
        }),
      )
      .get('/', async (c) => {
        expect(c.var.ronin).toBeDefined();

        const users = await c.var.ronin.get.users();

        expect(users).toBeDefined();
        expect(users).toBeInstanceOf(Array);

        return c.json(users);
      });

    const response = await testClient(app, {
      RONIN_TOKEN: import.meta.env.RONIN_TOKEN,
    }).index.$get();

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const json = await response.json();

    expect(json).toBeDefined();
    expect(json).toBeInstanceOf(Array);
    expect(json).toHaveLength(1);
  });

  it('with a missing RONIN token', async () => {
    let receivedError: Error | undefined;

    const app = factory
      .createApp()
      .use('*', ronin({ fetch: fetcher }))
      .get('/', async (c) => {
        expect(c.var.ronin).toBeDefined();

        const posts = (await c.var.ronin.get.blogPosts()) as Array<unknown>;

        return c.json(posts);
      })
      .onError((err) => {
        receivedError = err;
        return new Response();
      });

    await testClient(app, {
      RONIN_TOKEN: null,
    }).index.$get();

    expect(receivedError).toMatchObject({
      message:
        'Either a `RONIN_TOKEN` environment variable or a `token` option must be provided for the RONIN middleware',
    });
  });

  it('with a `null` RONIN token', async () => {
    let receivedError: Error | undefined;

    const app = factory
      .createApp()
      .use(
        '*',
        ronin({
          fetch: fetcher,
          // @ts-expect-error `null` is not allowed here.
          token: null,
        }),
      )
      .get('/', async (c) => {
        expect(c.var.ronin).toBeDefined();

        const posts = (await c.var.ronin.get.blogPosts()) as Array<unknown>;

        return c.json(posts);
      })
      .onError((err) => {
        receivedError = err;
        return new Response();
      });

    await testClient(app, {
      RONIN_TOKEN: null,
    }).index.$get();

    expect(receivedError).toMatchObject({
      message:
        'Either a `RONIN_TOKEN` environment variable or a `token` option must be provided for the RONIN middleware',
    });
  });
});
