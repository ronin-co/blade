import path from 'node:path';
import { serve as serveApp } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import chalk from 'chalk';
import { Hono } from 'hono';

import {
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
} from '@/private/shell/constants';
import { CLIENT_ASSET_PREFIX } from '@/private/universal/utils/constants';

export const serve = async (environment: 'development' | 'production', port: number) => {
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
    const worker = await globalThis.SHELL_STATE;
    return worker.default.fetch(c.req.raw);
  });

  const server = serveApp({ fetch: app.fetch, port });

  process.on('SIGINT', () => {
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.close((err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      process.exit(0);
    });
  });

  console.log(
    `${loggingPrefixes.info} Serving app on ${chalk.underline(`http://localhost:${port}`)}\n`,
  );
};
