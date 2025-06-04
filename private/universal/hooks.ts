import { useContext } from 'react';

import { RootClientContext } from '@/private/client/context';
import { RootServerContext } from '@/private/server/context';
import {
  type UniversalContext,
  getSerializableContext,
} from '@/private/universal/context';

const useUniversalContext = (): UniversalContext => {
  if (typeof window === 'undefined') {
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
const usePrivateLocation = (): URL => new URL(useUniversalContext().url);

export { useUniversalContext, usePrivateLocation };
