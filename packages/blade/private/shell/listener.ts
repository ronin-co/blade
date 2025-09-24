import path from 'node:path';
import { serve as serveApp } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import chalk from 'chalk';
import { Hono } from 'hono';
import { compress } from 'hono/compress';

import {
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
} from '@/private/shell/constants';
import { polyfillCompressionStream } from '@/private/shell/utils/polyfills';
import { CLIENT_ASSET_PREFIX } from '@/private/universal/utils/constants';

export interface ServerState {
  module?: Promise<{ default: Hono }>;
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

  // If `blade serve` is used to serve the application, add support for compressing
  // responses depending on the incoming request headers, since there might not be a
  // proxy in front that handles compression.
  //
  // If there is a proxy in front that handles compression, we assume that it wouldn't
  // pass the `Accept-Encoding` header through to the origin.
  if (environment === 'production') {
    // Enable necessary polyfills on unsupported runtimes.
    polyfillCompressionStream();

    // Enable the compression middleware.
    app.use(compress());
  }

  const clientPathPrefix = new RegExp(`^\/${CLIENT_ASSET_PREFIX}`);

  // Serve files located in the `public` directory.
  app.use('*', serveStatic({ root: path.basename(publicDirectory) }));

  // Source maps should only be accessible during development.
  if (environment !== 'development') {
    app.use(`/${CLIENT_ASSET_PREFIX}/:path{.+\\.map}`, async (c) => c.notFound());
  }

  // Serve files located in the `.blade/client` output directory.
  app.use(
    `/${CLIENT_ASSET_PREFIX}/*`,
    serveStatic({
      // It's extremely important for requests to be scoped to the client output.
      // directory, since server code could otherwise be read.
      root: path.join(outputDirectory.replace(process.cwd(), ''), CLIENT_ASSET_PREFIX),
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
