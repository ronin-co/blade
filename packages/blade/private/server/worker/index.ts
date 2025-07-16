import { DML_QUERY_TYPES_WRITE } from 'blade-compiler';
import { bundleId } from 'build-meta';
import { getCookie } from 'hono/cookie';
import { SSEStreamingApi } from 'hono/streaming';
import { Hono } from 'hono/tiny';
import type { Query, QueryType } from 'ronin/types';
import { ClientError } from 'ronin/utils';
import { router as projectRouter, triggers as triggerList } from 'server-list';

import type { ServerContext } from '@/private/server/context';
import { getWaitUntil, runQueries, toDashCase } from '@/private/server/utils/data';
import {
  getRequestGeoLocation,
  getRequestLanguages,
  getRequestUserAgent,
} from '@/private/server/utils/request-context';
import renderReactTree, {
  flushSession,
  type Collected,
} from '@/private/server/worker/tree';
import { prepareTriggers } from '@/private/server/worker/triggers';
import type { PageFetchingOptions } from '@/private/universal/types/util';
import { CLIENT_ASSET_PREFIX } from '@/private/universal/utils/constants';
import { TriggerError } from '@/public/server/utils/errors';

type Bindings = {
  ASSETS: {
    fetch: typeof fetch;
  };
};

// This should be done as early as possible in the file.
//
// If this variable is already defined when the file gets evaluated, that means the file
// was evaluated previously already, so we're dealing with local HMR.
//
// In that case, we want to push an updated version of every page to the client.
if (globalThis.DEV_SESSIONS) {
  globalThis.DEV_SESSIONS.forEach(({ stream, url, headers }) => {
    return flushSession(stream, url, headers, false);
  });
} else {
  globalThis.DEV_SESSIONS = new Map();
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  const requestURL = new URL(c.req.url);

  // - `requestOrigin` might be `https://ronin.co`
  // - `requestPath` might be `/account/settings`
  const { origin: requestOrigin, pathname: requestPath } = requestURL;

  // If there's a static file available for the current request path in the JS/CSS
  // bundles (/client) or in the `public` directory of the app (/static), we should
  // immediately respond with it.
  //
  // The check must be performed before matching available pages, because there might be
  // pages that use dynamic segments and therefore capture the entire path, which would
  // mean all matching static file paths would be captured.
  //
  // Instead, just like it is the case in the local development server (where static
  // files are handled outside the worker), we want to handle the static files first,
  // before the pages.
  if (
    typeof c.env?.['ASSETS'] !== 'undefined' &&
    (requestPath.startsWith(`/${CLIENT_ASSET_PREFIX}`) ||
      requestPath.startsWith('/static'))
  ) {
    const newRequest = new Request(requestOrigin + requestPath, c.req.raw);
    const response = await c.env['ASSETS'].fetch(newRequest);

    if (response.status !== 404) return response;
  }

  await next();
});

// Strip trailing slashes.
app.all('*', async (c, next) => {
  const currentPathname = c.req.path;

  if (currentPathname.endsWith('/') && currentPathname !== '/') {
    const newPathname = currentPathname.substring(0, currentPathname.length - 1);
    return c.redirect(newPathname, 307);
  }

  await next();
});

// Expose an API endpoint that allows for accessing the provided triggers.
app.post('/api', async (c) => {
  console.log('[BLADE] Received request to /api');

  const body = await c.req.json<{ queries?: Query[] }>();
  const headers = c.req.raw.headers;
  const queries = body?.queries;

  // Ensure a valid incoming query body.
  if (
    !queries ||
    !Array.isArray(queries) ||
    queries.length === 0 ||
    queries.some((query) => typeof query !== 'object')
  ) {
    return c.json(
      {
        error: {
          message: 'Missing valid queries.',
          code: 'MISSING_QUERIES',
        },
      },
      400,
    );
  }

  const waitUntil = getWaitUntil(c);

  const serverContext: ServerContext = {
    url: c.req.url,
    params: {},
    userAgent: getRequestUserAgent(headers),
    geoLocation: getRequestGeoLocation(headers),
    languages: getRequestLanguages(headers),
    addressBarInSync: true,

    cookies: getCookie(c),
    collected: {
      queries: [],
      metadata: {},
      jwts: {},
    },
    currentLeafIndex: null,
    waitUntil,
  };

  // Generate a list of trigger functions based on the trigger files that exist in the
  // source code of the application.
  const triggers = prepareTriggers(serverContext, triggerList, true);

  // For every query, check whether an trigger exists that is being publicly exposed.
  // If none exists, prevent the query from being executed.
  for (const query of queries) {
    const queryType = Object.keys(query)[0] as QueryType;
    const querySchema = Object.keys(query[queryType] as object)[0] as string;

    const schemaSlug = querySchema.endsWith('s')
      ? querySchema.substring(0, querySchema.length - 1)
      : querySchema;

    const triggerSlug = toDashCase(schemaSlug);
    const triggerFile = triggers[triggerSlug];

    if (!triggerFile || !triggerFile['exposed']) {
      throw new ClientError({
        message: 'Please provide a trigger that is marked as `exposed`.',
        code: 'TRIGGER_REQUIRED',
      });
    }
  }

  let results: unknown[];

  // Run the queries and handle any errors that might occur.
  try {
    results = (await runQueries({ default: queries }, triggers, 'all', waitUntil))[
      'default'
    ];
  } catch (err) {
    if (err instanceof TriggerError || err instanceof ClientError) {
      const allowedFields = ['message', 'code', 'path', 'query', 'details', 'fields'];
      const error: Record<string, unknown> = {};

      for (const field of allowedFields) {
        const value = (err as unknown as Record<string, unknown>)[field];
        if (typeof value !== 'undefined') error[field] = value;
      }

      return c.json({ error }, 400);
    }

    throw err;
  }

  // Return the results of the provided queries.
  return c.json({ results });
});

// If the application defines its own Hono instance, we need to mount it here.
if (projectRouter) app.route('/', projectRouter);

// Handle the initial render (first byte).
app.get('*', (c) =>
  renderReactTree(new URL(c.req.url), c.req.raw.headers, true, {
    waitUntil: getWaitUntil(c),
  }),
);

// Handle client side navigation.
app.post('*', async (c) => {
  if (c.req.header('accept') !== 'text/event-stream') {
    const body = {
      error: {
        message: 'The request for opening a session is malformed.',
        code: 'INVALID_PAYLOAD',
      },
    };

    return c.json(body, 400);
  }

  const body = await c.req.parseBody<{ options?: string; files: File }>({ all: true });
  const options: PageFetchingOptions = body.options
    ? JSON.parse(body.options)
    : undefined;
  const files = body.files
    ? Array.isArray(body.files)
      ? body.files
      : [body.files]
    : undefined;

  if (files) {
    options.files = new Map();

    for (const file of files) {
      options.files?.set(file.name, file);
    }
  }

  let queries: Collected['queries'] | undefined;

  if (options?.queries) {
    queries = options.queries;

    // Only accept DML write queries to be provided from the client.
    for (const { query } of queries) {
      const queryType = Object.keys(JSON.parse(query))[0] as QueryType;

      if (!(DML_QUERY_TYPES_WRITE as ReadonlyArray<QueryType>).includes(queryType)) {
        throw new ClientError({
          message: 'Only write queries shall be provided from the client.',
          code: 'TRIGGER_REQUIRED',
        });
      }
    }
  }

  const { readable, writable } = new TransformStream();
  const stream = new SSEStreamingApi(writable, readable);

  const url = new URL(c.req.url);
  const headers = c.req.raw.headers;

  // Check if the client-side bundle is correct. If it isn't, we will immediately send
  // the markup for the new bundles to the client. However, we will still consider the
  // queries of the incoming request, to make sure that writes aren't lost in the void,
  // even if the bundles have changed.
  const correctBundle = c.req.header('X-Bundle-Id') === bundleId;

  c.header('Transfer-Encoding', 'chunked');
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  flushSession(stream, url, headers, correctBundle, { queries, repeat: correctBundle });

  const id = crypto.randomUUID();

  // Track the session for HMR.
  globalThis.DEV_SESSIONS.set(id, { stream, url, headers });

  // Handle connection cleanup when the client disconnects.
  c.req.raw.signal.addEventListener('abort', () => {
    globalThis.DEV_SESSIONS.delete(id);
  });

  return c.newResponse(stream.responseReadable);
});

// Handle errors that occurred during the request lifecycle.
app.onError((err, c) => {
  console.error(err);

  // This error might be thrown by the framework (above), or by the client.
  if (err instanceof ClientError && err.code === 'TRIGGER_REQUIRED') {
    const body = {
      error: {
        message: 'No endpoint available for the provided query.',
        code: 'MISSING_ENDPOINT',
      },
    };

    return c.json(body, 400);
  }

  const message = 'An internal error occurred. Please try again later.';
  const status = 500;
  const acceptHeader = c.req.header('Accept');

  if (acceptHeader?.includes('application/json')) {
    const body = {
      error: {
        message,
        code: 'INTERNAL_ERROR',
      },
    };

    return c.json(body, status);
  }

  try {
    return renderReactTree(new URL(c.req.url), c.req.raw.headers, true, {
      error: 500,
      waitUntil: getWaitUntil(c),
    });
  } catch (err) {
    console.error(err);
  }

  return new Response(message, { status });
});

export default app;
