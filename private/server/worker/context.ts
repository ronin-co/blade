import type { AsyncLocalStorage } from 'node:async_hooks';

import type { ServerContext } from '@/private/server/context';

// The conditions below ensure that Bun's browser build does not strip the imports, which
// is important, since Bun does not yet offer a `worker` target for builds, so `browser`
// is the closest alternative.

export const SERVER_CONTEXT = (
  typeof window === 'undefined'
    ? new (await import('node:async_hooks'))['AsyncLocalStorage']()
    : null
) as AsyncLocalStorage<ServerContext>;

export const REACT_CONTEXT = (
  typeof window === 'undefined'
    ? new (await import('node:async_hooks'))['AsyncLocalStorage']()
    : null
) as AsyncLocalStorage<object>;
