import 'client-list';
import { hydrateRoot } from 'react-dom/client';

import '@/private/client/components/history';
import '@/public/client/components';
import fetchPage from '@/private/client/utils/fetch-page';

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
