import type { AsyncLocalStorage } from 'node:async_hooks';

import type { ServerContext } from '../context';

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
