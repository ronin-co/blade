import { type MutableRefObject, createContext } from 'react';

import type { UniversalContext } from '../universal/context';
import type { DeferredPromises } from './types/util';

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
