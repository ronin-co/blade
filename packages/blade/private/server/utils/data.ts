import { waitUntil as vercelWaitUntil } from '@vercel/functions';
import type { Context, ExecutionContext } from 'hono';

import type { WaitUntil } from '@/private/server/types';
import { VERBOSE_LOGGING } from '@/private/server/utils/constants';

/**
 * A minimal mock implementation of the `ExecutionContext` interface.
 */
const MOCK_EXECUTION_CONTEXT: ExecutionContext = {
  passThroughOnException: () => {},
  waitUntil: async (func) => {
    try {
      await func;
    } catch (err) {
      if (!VERBOSE_LOGGING) return;
      console.error('An error occurred while executing a `waitUntil` callback.');
      console.error(err);
    }
  },
};

/**
 * Get the `waitUntil` function from the current context. If the context does not
 * provide a `waitUntil` function, we use a mock implementation.
 *
 * @param context - The context of the current request.
 *
 * @returns A function that takes a promise and waits for it to resolve.
 */
export const getWaitUntil = (context?: Context): WaitUntil => {
  if (import.meta.env.__BLADE_PROVIDER === 'vercel') return vercelWaitUntil;

  // Trying to access `c.executionCtx` on a Node.js runtime, such as in a Vercel
  // function, will throw an error. So we need to add a mockfallback.
  let dataFetcherWaitUntil = MOCK_EXECUTION_CONTEXT.waitUntil;
  if (!context) return dataFetcherWaitUntil;

  try {
    dataFetcherWaitUntil = context.executionCtx.waitUntil?.bind(context.executionCtx);
  } catch (_err) {
    if (VERBOSE_LOGGING)
      console.warn('No execution context provided, using default implementation.');
  }

  return dataFetcherWaitUntil;
};

/**
 * Turn the given string into "dash-case", which we use for slugs.
 *
 * @param string - String to turn into dash-case.
 *
 * @returns String compatible with "dash-case".
 *
 * Originally from https://github.com/rayepps/radash/blob/7c6b986d19c68f19ccf5863d518eb19ec9aa4ab8/src/string.ts#L60-L71.
 */
export const toDashCase = (string?: string | null): string => {
  const capitalize = (str: string) => {
    const lower = str.toLowerCase();
    return lower.substring(0, 1).toUpperCase() + lower.substring(1, lower.length);
  };

  const parts =
    string
      ?.replace(/([A-Z])+/g, capitalize)
      ?.split(/(?=[A-Z])|[.\-\s_]/)
      .map((x) => x.toLowerCase()) ?? [];

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  return parts.reduce((acc, part) => `${acc}-${part.toLowerCase()}`);
};
