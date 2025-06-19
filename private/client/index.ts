import 'server-list';
import { hydrateRoot } from 'react-dom/client';

import '@/private/client/components/history';
import '@/public/client/components';
import fetchPage from '@/private/client/utils/fetch-page';

if (!window['BLADE_ROOT']) {
  const path = location.pathname + location.search + location.hash;

  fetchPage(path).then((page) => {
    if (!page) throw new Error('Fetched page missing for initial render.');

    window['BLADE_ROOT'] = hydrateRoot(document, page.body, {
      onRecoverableError(error, errorInfo) {
        console.error('Hydration error occurred:', error, errorInfo);
      },
    });
  });
}
