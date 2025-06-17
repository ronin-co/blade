import { serve as serveApp } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import chalk from 'chalk';
import { Hono } from 'hono';
import type { WSContext } from 'hono/ws';

import {
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
} from '@/private/shell/constants';
import { CLIENT_ASSET_PREFIX } from '@/private/universal/utils/constants';

export const serve = async (
  environment: 'development' | 'production',
  port: number,
  serverModule: Promise<any>,
): Promise<WSContext> => {
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

  let webSocketContext: WSContext | undefined;
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  if (environment === 'development') {
    app.get(
      '/_blade/reload',
      upgradeWebSocket(() => ({
        onOpen: (_event, socket) => (webSocketContext = socket),
      })),
    );
  }

  app.use('/*', serveStatic({ root: publicDirectory }));
  app.use(`/${CLIENT_ASSET_PREFIX}/*`, serveStatic({ root: outputDirectory }));

  app.use('*', async (_c, next) => {
    await serverModule;
    await next();
  });
  app.route('/', serverModule as unknown as Hono);

  const server = serveApp({ fetch: app.fetch, port });
  if (environment === 'development') injectWebSocket(server);

  console.log(
    `${loggingPrefixes.info} Serving app on ${chalk.underline(`http://localhost:${port}`)}\n`,
  );

  return webSocketContext as WSContext;
};
