import type BuildError from '@/private/universal/types/build-error';

/**
 * A map of message types to their associated payload types.
 * Each key is a unique string identifier for a message type,
 * and the value defines the expected shape of the `message` payload.
 */
export type StateMessageMap = {
  ok: null;
  'build-error': BuildError[];
};

/**
 * Dynamically builds a union of message types from StateMessageMap.
 *
 * Example: { type: 'build-error'; message: array of BuildError }
 */
export type State = {
  [K in keyof StateMessageMap]: {
    type: K;
    message: StateMessageMap[K];
  };
}[keyof StateMessageMap];
