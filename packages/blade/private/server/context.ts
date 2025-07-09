import { createContext } from 'react';

import type { WaitUntil } from '@/private/server/types';
import type { Collected } from '@/private/server/worker/tree';
import type { UniversalContext } from '@/private/universal/context';

/** This context can only be consumed by server components. */
export type ServerContext<
  TParams extends Record<string, unknown> | Array<string> = Record<
    string,
    string | Array<string> | null
  >,
> = Omit<UniversalContext<TParams>, 'collected'> & {
  cookies: Record<string, string | null>;
  collected: Collected;
  currentLeafIndex: number | null;
  waitUntil: WaitUntil;
  flushUI: (collected?: Collected) => Promise<void>;
};

export const RootServerContext = createContext<ServerContext | null>(null);
