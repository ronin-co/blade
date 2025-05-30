import { AsyncLocalStorage } from 'node:async_hooks';

import type { ServerContext } from '@/private/server/context';

export const SERVER_CONTEXT = new AsyncLocalStorage<ServerContext>();
export const REACT_CONTEXT = new AsyncLocalStorage<object>();
