import { createMiddleware } from 'hono/factory';
import createFactory from 'ronin';

import type { Context } from 'hono';
import type { QueryHandlerOptions } from 'ronin/types';

type Factory = ReturnType<typeof createFactory>;

export type Bindings = {
  RONIN_TOKEN: string;
};

export type Variables = {
  ronin: Factory;
};

type Env = {
  Bindings: Bindings;
  Variables: Variables;
};

interface Options extends QueryHandlerOptions {}

/**
 * Create a Hono middleware that injects a RONIN client into the Hono context variables.
 *
 * @param options - An optional object that can be used to configure the RONIN client.
 *
 * @example .env
 * ```bash
 * RONIN_TOKEN=your-ronin-token
 * ```
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { ronin, type Bindings, type Variables } from '@ronin/hono';
 *
 * const app = new Hono()
 * 	.use('*', ronin())
 * 	.get('/', async (c) => {
 * 		const posts = await c.var.ronin.get.posts();
 * 		return c.json(posts);
 * 	});
 * ```
 *
 * @returns A Hono middleware.
 */
export const ronin = (options?: Options | ((context: Context) => Options)) =>
  createMiddleware<Env>(async (c, next) => {
    const userOptions = options
      ? typeof options === 'function'
        ? options(c)
        : options
      : ({} satisfies QueryHandlerOptions);

    const token = userOptions.token ?? c.env.RONIN_TOKEN;
    if (!token)
      throw new Error(
        'Either a `RONIN_TOKEN` environment variable or a `token` option must be provided for the RONIN middleware',
      );

    const client = createFactory({
      ...userOptions,
      token,
    });

    c.set('ronin', client);

    await next();
  });
