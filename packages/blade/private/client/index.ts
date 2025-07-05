import 'client-list';
import { bundleId } from 'build-meta';
import { hydrateRoot } from 'react-dom/client';

import '@/private/client/components/history';
import '@/public/client/components';
import { mountNewBundle } from '@/private/client/utils/page';
import { createFromReadableStream } from '@/private/client/utils/parser';

if (!window['BLADE_SESSION']) {
  const id = crypto.randomUUID();
  const url = new URL('/_blade/session', window.location.origin);

  // Inform the server about the page that is currently being viewed. Whenever the client
  // retrieves a new page, the session will be updated on the server.
  url.searchParams.set('id', id);
  url.searchParams.set('url', window.location.pathname + window.location.search);
  url.searchParams.set('bundleId', bundleId);

  // Open the event stream.
  const source = new EventSource(url, { withCredentials: true });

  const handleMessage = async (message: MessageEvent) => {
    const serverBundleId = message.lastEventId.split('-').pop() as string;

    if (message.type === 'update') {
      const stream = new Blob([message.data]).stream();
      const body = await createFromReadableStream(stream);

      if (window['BLADE_SESSION']) {
        window['BLADE_SESSION'].root.render(body);
      } else {
        const root = hydrateRoot(document, body, {
          onRecoverableError(error, errorInfo) {
            console.error('Hydration error occurred:', error, errorInfo);
          },
        });

        window['BLADE_SESSION'] = { id, source, root };
      }

      return;
    }

    if (message.type === 'update-bundle') {
      mountNewBundle(serverBundleId, message.data);
    }
  };

  source.addEventListener('update', handleMessage);
  source.addEventListener('update-bundle', handleMessage);
}
