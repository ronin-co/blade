import { AsyncLocalStorage } from 'node:async_hooks';

import type { HookContext } from 'ronin/types';

import type { ServerContext } from '../context';

export const SERVER_CONTEXT = (
  typeof window === 'undefined' ? new AsyncLocalStorage() : null
) as AsyncLocalStorage<ServerContext>;

export const HOOK_CONTEXT = (
  typeof window === 'undefined' ? new AsyncLocalStorage() : null
) as AsyncLocalStorage<HookContext>;

export const REACT_CONTEXT = (
  typeof window === 'undefined' ? new AsyncLocalStorage() : null
) as AsyncLocalStorage<HookContext>;
