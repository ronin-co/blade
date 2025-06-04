import type { Context } from 'hono';
import { createContext } from 'react';

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
  requestContext: Context;
  collected: Collected;
  currentLeafIndex: number | null;
};

export const RootServerContext = createContext<ServerContext | null>(null);
