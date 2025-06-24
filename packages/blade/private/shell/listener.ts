import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Server } from 'bun';
import chalk from 'chalk';
import { Hono } from 'hono';

import {
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
} from '@/private/shell/constants';
import { CLIENT_ASSET_PREFIX } from '@/private/universal/utils/constants';

export interface ServerState {
  module?: Promise<{ default: Hono }>;
  channel?: Server;
}

export const serve = async (
  serverState: ServerState,
  environment: 'development' | 'production',
  port: number,
) => {
  if (environment === 'production') {
    // Prevent the process from exiting when an exception occurs.
    process.on('uncaughtException', (error) => {
      console.error('An uncaught exception has occurred:', error);
    });

    // Prevent the process from exiting when a rejection occurs.
    process.on('unhandledRejection', (reason, promise) => {
      console.error('An uncaught rejection has occurred:', reason, promise);
    });
  }

  const app = new Hono();

  const clientPathPrefix = new RegExp(`^\/${CLIENT_ASSET_PREFIX}`);
  app.use('*', serveStatic({ root: path.basename(publicDirectory) }));
  app.use(
    `/${CLIENT_ASSET_PREFIX}/*`,
    serveStatic({
      // It's extremely important for requests to be scoped to the client output.
      // directory, since server code could otherwise be read.
      root: path.join(path.basename(outputDirectory), CLIENT_ASSET_PREFIX),
      rewriteRequestPath: (path) => path.replace(clientPathPrefix, ''),
      onFound: (_path, c) => {
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );

  app.all('*', async (c) => {
    const worker = await serverState.module;
    return worker!.default.fetch(c.req.raw);
  });

  serverState.channel = Bun.serve({
    port,
    development: environment === 'development',
    fetch: (request) => {
      let pathname: string;

      try {
        ({ pathname } = new URL(request.url));
      } catch (_err) {
        // If the request URL is malformed, reject the request. For example, this can
        // happen if the request is missing a `Host` header. The correct response in such
        // a scenario is defined here:
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Host
        return new Response('Bad Request', { status: 400 });
      }

      // Enable WebSockets for automatically triggering revalidation when files are updated
      // during development.
      if (environment === 'development' && pathname.startsWith('/_blade/reload')) {
        serverState.channel!.upgrade(request);
        return;
      }

      return app.fetch(request, {});
    },
    websocket: {
      open: (socket) => socket.subscribe('development'),
      close: (socket) => socket.unsubscribe('development'),
      // We don't care about incoming messages, but the type requires this.
      message() {},
    },
  });

  console.log(
    `${loggingPrefixes.info} Serving app on ${chalk.underline(`http://localhost:${port}`)}\n`,
  );
};
