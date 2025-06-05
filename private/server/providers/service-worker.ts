import { handle } from 'hono/service-worker';

import app from '../worker/index';

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Ensure that requests targeting client-side assets are bypassing the service worker.
  if (url.pathname.startsWith('/client')) return;

  return handle(app as any)(event as any) as any;
});
