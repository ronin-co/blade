import 'client-list';
import { hydrateRoot } from 'react-dom/client';

import '@/private/client/components/history';
import '@/public/client/components';
import { fetchPage } from '@/private/client/utils/page';

if (!window['BLADE_SESSION']) {
  const path = location.pathname + location.search + location.hash;

  fetchPage(path).then((page) => {
    // If the client bundles have changed since they were downloaded, don't proceed,
    // since `fetchPage` will retrieve the latest bundles fresh in that case.
    if (!page) return;

    const root = hydrateRoot(document, page, {
      onRecoverableError(error, errorInfo) {
        console.error('Hydration error occurred:', error, errorInfo);
      },
    });

    const id = crypto.randomUUID();
    window['BLADE_SESSION'] = { id, root };
  });
}
