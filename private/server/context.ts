import type { Context } from 'hono';

import type { UniversalContext } from '../universal/context';
import type { Collected } from './worker/tree';

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
