import 'client-list';
import { bundleId } from 'build-meta';
import { hydrateRoot } from 'react-dom/client';

import '@/private/client/components/history';
import '@/public/client/components';
import { fetchPage, mountNewBundle } from '@/private/client/utils/page';
import { createFromReadableStream } from '@/private/client/utils/parser';

if (!window['BLADE_SESSION']) {
  window['BLADE_SESSION'] = crypto.randomUUID();
}

if (!window['BLADE_ROOT']) {
  const path = location.pathname + location.search + location.hash;

  fetchPage(path).then((page) => {
    // If the client bundles have changed since they were downloaded, don't proceed,
    // since `fetchPage` will retrieve the latest bundles fresh in that case.
    if (!page) return;

    window['BLADE_ROOT'] = hydrateRoot(document, page.body, {
      onRecoverableError(error, errorInfo) {
        console.error('Hydration error occurred:', error, errorInfo);
      },
    });
  });
}

if (!window['BLADE_ROOT']) {
  const url = new URL('/_blade/session', window.location.origin);

  // Inform the server about the page that is currently being viewed. Whenever the
  // client retrieves a new page, the session will be updated on the server.
  url.searchParams.set('id', window['BLADE_SESSION'] as string);
  url.searchParams.set('url', window.location.pathname + window.location.search);
  url.searchParams.set('bundleId', bundleId);

  // Open the event stream.
  const eventSource = new EventSource(url, { withCredentials: true });

  const handleMessage = async (message: MessageEvent) => {
    const [_id, serverBundleId] = message.lastEventId.split('-');

    if (message.type === 'update') {
      const stream = new Blob([message.data]).stream();
      const body = await createFromReadableStream(stream);

      if (window['BLADE_ROOT']) {
        window['BLADE_ROOT'].render(body);
      } else {
        window['BLADE_ROOT'] = hydrateRoot(document, body, {
          onRecoverableError(error, errorInfo) {
            console.error('Hydration error occurred:', error, errorInfo);
          },
        });
      }

      return;
    }

    if (message.type === 'update-bundle') {
      mountNewBundle(serverBundleId, message.data);
    }
  };

  eventSource.addEventListener('update', handleMessage);
  eventSource.addEventListener('update-bundle', handleMessage);
}
