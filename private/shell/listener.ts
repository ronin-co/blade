import * as Sentry from '@sentry/bun';
import { type Server, plugin } from 'bun';
import chalk from 'chalk';

import {
  loggingPrefixes,
  outputDirectory,
  publicDirectory,
  serverInputFile,
  serverOutputFile,
} from '@/private/shell/constants';
import {
  getClientReferenceLoader,
  getFileListLoader,
  getMdxLoader,
  getReactAriaLoader,
} from '@/private/shell/loaders';
import {
  cleanUp,
  getClientEnvironmentVariables,
  prepareClientAssets,
} from '@/private/shell/utils';
import {
  CLIENT_ASSET_PREFIX,
  SENTRY_ENVIRONMENT,
} from '@/private/universal/utils/constants';

const environment = Bun.env['BLADE_ENV'];
const port = Bun.env['__BLADE_PORT'];

if (environment === 'development') {
  await cleanUp();
  await prepareClientAssets('development');

  plugin(getClientReferenceLoader(environment));
  plugin(getFileListLoader(false));
  plugin(getMdxLoader(environment));
  plugin(getReactAriaLoader());
} else {
  // In cases where BLADE is run as a standalone server in production, we need a
  // separate Sentry instance outside of the worker file to catch all errors.
  Sentry.init({
    dsn: import.meta.env.BLADE_PUBLIC_SENTRY_DSN,
    release: import.meta.env.BLADE_PUBLIC_GIT_COMMIT,
    environment: SENTRY_ENVIRONMENT,
  });

  // Prevent the process from exiting when an exception occurs.
  process.on('uncaughtException', (error) => {
    console.error('An uncaught exception has occurred:', error);
    Sentry.captureException(error);
  });

  // Prevent the process from exiting when a rejection occurs.
  process.on('unhandledRejection', (reason, promise) => {
    console.error('An uncaught rejection has occurred:', reason, promise);
    Sentry.captureException(reason, { extra: { promise } });
  });
}

const requestHandler = await import(
  environment === 'development' ? serverInputFile : serverOutputFile
);

const assetHeaders: Record<string, string> =
  environment === 'production'
    ? {
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    : {};

const server: Server = Bun.serve({
  port,
  development: environment === 'development',
  fetch: async (request) => {
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
      return server.upgrade(request);
    }

    const outputFile = Bun.file(outputDirectory + pathname);
    const publicFile = Bun.file(publicDirectory + pathname);

    const [outputFileExists, publicFileExists] = await Promise.all([
      outputFile.exists(),
      publicFile.exists(),
    ]);

    if (outputFileExists) {
      if (pathname.startsWith(CLIENT_ASSET_PREFIX) && pathname.endsWith('.js')) {
        const fileContents = await outputFile.text();
        const variables = `import.meta.env=${JSON.stringify(getClientEnvironmentVariables())};`;
        const newFileContents = variables + fileContents;

        return new Response(newFileContents, {
          headers: {
            'Content-Type': outputFile.type,
            ...assetHeaders,
          },
        });
      }

      return new Response(outputFile, {
        headers: { ...assetHeaders },
      });
    }

    if (publicFileExists) return new Response(publicFile);

    return requestHandler.default.fetch(request, {}, {});
  },
  websocket:
    environment === 'development'
      ? {
          open: (socket) => socket.subscribe('development'),
          close: (socket) => socket.unsubscribe('development'),
          // We don't care about incoming messages, but the type requires this.
          message() {},
        }
      : undefined,
});

if (environment === 'development') {
  // Trigger a revalidation from the client-side whenever the process starts, as the
  // process is restarted whenever server-side code changes.
  //
  // When the process starts the first time and there aren't yet any clients subscribed
  // to the WebSocket topic, this will just do nothing.
  server.publish('development', 'revalidate');
}

console.log(
  `${loggingPrefixes.info} Serving app on ${chalk.underline(`http://localhost:${port}`)}\n`,
);
