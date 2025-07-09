import { DML_QUERY_TYPES_WRITE } from '@ronin/compiler';

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
    flushSession: (collected) =>
      flushSession(c.req.header('X-Session-Id') ?? null, { collected }),
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

// If this variable is already defined when the file gets evaluated, that means the file
// was evaluated previously already, so we're dealing with local HMR.
//
// In that case, we want to push an updated version of every page to the client.
if (globalThis.SERVER_SESSIONS) {
  globalThis.SERVER_SESSIONS.forEach((_session, sessionId) => flushSession(sessionId));
} else {
  globalThis.SERVER_SESSIONS = new Map();
}

app.get('/_blade/session', async (c) => {
  const currentURL = new URL(c.req.url);
  const { searchParams } = currentURL;

  const sessionID = searchParams.get('id');
  const sessionURL = searchParams.get('url');
  const sessionBundle = searchParams.get('bundleId');

  if (
    c.req.header('accept') !== 'text/event-stream' ||
    !sessionID ||
    !sessionURL ||
    !sessionBundle
  ) {
    const body = {
      error: {
        message: 'The request for opening a session is malformed.',
        code: 'INVALID_PAYLOAD',
      },
    };

    return c.json(body, 400);
  }

  const { readable, writable } = new TransformStream();
  const stream = new SSEStreamingApi(writable, readable);

  c.header('Transfer-Encoding', 'chunked');
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  const pageURL = new URL(sessionURL, currentURL);

  const sessionDetails = {
    url: pageURL,
    headers: c.req.raw.headers,
    stream,
    bundleId: sessionBundle,
    // We're purposefully using a `Promise` instead of `setInterval`, since the latter is
    // prone to race conditions, because the interval continues running, even if the
    // action hasn't yet been completed. Using our `Promise`, we ensure that the time
    // only starts counting down once the action is completed.
    interval: Promise.resolve(),
  };

  globalThis.SERVER_SESSIONS.set(sessionID, sessionDetails);

  // Once we've created the session, flush an update for it.
  //
  // It's critical to not `await` this function call, since the response further below
  // must be returned before the session is completely flushed (as quickly as possible).
  //
  // This also ensures that, in short-lived environments such as Cloudflare Workers, the
  // worker stays alive as long as there are open sessions. Because they get terminated
  // as soon as the V8 event loop is empty, so by ensuring that there is always something
  // in the event loop as long as a connection is open, we keep the worker alive.
  //
  // Using `waitUntil` with a promise that remains pending until the connection closes
  // wouldn't work because Cloudflare detects those kinds of forever-pending promises and
  // forcefully terminates the worker in those cases, to avoid potential memory leaks.
  //
  // Since `setTimeout` does not count toward CPU time, Cloudflare thankfully doesn't
  // charge for this idle time.
  sessionDetails.interval = flushSession(sessionID, { repeat: true });

  // Handle connection cleanup when the client disconnects.
  c.req.raw.signal.addEventListener('abort', () => {
    globalThis.SERVER_SESSIONS.delete(sessionID);
  });

  return c.newResponse(stream.responseReadable);
});

// Handle the initial render (first byte).
app.get('*', (c) =>
  renderReactTree(new URL(c.req.url), c.req.raw.headers, true, {
    waitUntil: getWaitUntil(c),
  }),
);

// Handle client side navigation.
app.post('*', async (c) => {
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

  const existingCollected: Collected = {
    queries: [],
    metadata: {},
    jwts: {},
  };

  if (options?.queries) {
    const list = options.queries;
    existingCollected.queries = list;

    // Only accept DML write queries to be provided from the client.
    for (const { query } of list) {
      const queryType = Object.keys(JSON.parse(query))[0] as QueryType;

      if (!(DML_QUERY_TYPES_WRITE as ReadonlyArray<QueryType>).includes(queryType)) {
        throw new ClientError({
          message: 'Only write queries shall be provided from the client.',
          code: 'TRIGGER_REQUIRED',
        });
      }
    }
  }

  const finalOptions = { ...options, waitUntil: getWaitUntil(c) };
  return renderReactTree(
    new URL(c.req.url),
    c.req.raw.headers,
    false,
    finalOptions,
    existingCollected,
  );
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
