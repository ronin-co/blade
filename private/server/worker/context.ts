import { AsyncLocalStorage } from 'node:async_hooks';

import type { ServerContext } from '@/private/server/context';

// The conditions below are used because the file is consumed by the universal context,
// which means that it is also used in the browser, as part of the client context.

export const SERVER_CONTEXT = (
  AsyncLocalStorage ? new AsyncLocalStorage() : undefined
) as AsyncLocalStorage<ServerContext>;
export const REACT_CONTEXT = (
  AsyncLocalStorage ? new AsyncLocalStorage() : undefined
) as AsyncLocalStorage<object>;
