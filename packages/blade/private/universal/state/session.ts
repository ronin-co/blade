import type { State } from '@/private/universal/types/state';

/**
 * In-memory dev-only session state.
 *
 * Works only in the `shell/` layer (not workers).
 *    + Lives on `globalThis` so it survives hot reloads.
 *    + Cannot be used inside isolated worker modules.
 *    + Used to persist build errors and misc state across rebuilds.
 */

/**
 * Unique symbol to store singleton on globalThis.
 */
const globalSymbol = Symbol.for('blade.dev.singleton.state');

/**
 * Gets or creates the shared singleton state object.
 */
const getSingleton = (): { state: State } => {
  const g = globalThis as any;
  if (!g[globalSymbol]) {
    g[globalSymbol] = { state: { type: 'ok' } };
  }
  return g[globalSymbol];
};

/**
 * Session state accessors.
 * Read/write from the singleton during development.
 */
export const sessionState = {
  get(): State {
    return getSingleton().state;
  },
  set(state: State) {
    getSingleton().state = state;
  },
  clear() {
    getSingleton().state = { type: 'ok', message: null };
  },
};
