import { type MutableRefObject, createContext } from 'react';

import type { DeferredPromises } from '@/private/client/types/util';
import type { UniversalContext } from '@/private/universal/context';

/** This context can only be consumed by client components. */
export type ClientContext<
  TParams extends Record<string, unknown> | Array<string> = Record<
    string,
    string | Array<string> | null
  >,
  TReturn extends Array<unknown> = Array<unknown>,
> = UniversalContext<TParams> & {
  deferredPromises: MutableRefObject<DeferredPromises<TReturn>>;
  setClientQueryParams: (queryParams: string) => void;
};

export const RootClientContext = createContext<ClientContext | null>(null);
