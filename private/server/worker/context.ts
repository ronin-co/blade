import type { AsyncLocalStorage } from 'node:async_hooks';

import type { HookContext } from 'ronin/types';

import type { ServerContext } from '../context';

export const SERVER_CONTEXT = (
  typeof window === 'undefined'
    ? new (await import('node:async_hooks'))['AsyncLocalStorage']()
    : null
) as AsyncLocalStorage<ServerContext>;

export const HOOK_CONTEXT = (
  typeof window === 'undefined'
    ? new (await import('node:async_hooks'))['AsyncLocalStorage']()
    : null
) as AsyncLocalStorage<HookContext>;

export const BATCH_CONTEXT = (
  typeof window === 'undefined'
    ? new (await import('node:async_hooks'))['AsyncLocalStorage']()
    : null
) as AsyncLocalStorage<boolean>;

export const REACT_CONTEXT = (
  typeof window === 'undefined'
    ? new (await import('node:async_hooks'))['AsyncLocalStorage']()
    : null
) as AsyncLocalStorage<HookContext>;
