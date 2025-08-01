import { useContext } from 'react';

import { RootClientContext } from '@/private/client/context';
import { RootServerContext } from '@/private/server/context';
import {
  type UniversalContext,
  getSerializableContext,
} from '@/private/universal/context';

const useUniversalContext = (): UniversalContext => {
  // @ts-expect-error The `Netlify` global only exists in the Netlify environment.
  const isNetlify = typeof Netlify !== 'undefined';
  if (typeof window === 'undefined' || isNetlify) {
    const serverContext = useContext(RootServerContext);
    if (!serverContext)
      throw new Error('Missing server context in `useUniversalContext`');

    return getSerializableContext(serverContext);
  }

  const clientContext = useContext(RootClientContext);
  if (!clientContext) throw new Error('Missing client context in `useUniversalContext`');

  const { deferredPromises, ...universalContext } = clientContext;
  return universalContext;
};

// We're creating a new `URL` object here, which ensures that any modifications applied
// by developers to what the hook returns won't affect other instances of the hook.
const usePrivateLocation = (): URL => {
  const url = new URL(useUniversalContext().url);

  // @ts-expect-error The `Netlify` global only exists in the Netlify environment.
  const isNetlify = typeof Netlify !== 'undefined';
  if (typeof window === 'undefined' || isNetlify) return url;

  // In the browser, we need to read the URL hash from the `window` object, since
  // browsers don't send the URL hash to the server.
  url.hash = window.location.hash;

  return url;
};

export { useUniversalContext, usePrivateLocation };
