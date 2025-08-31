import { SSEStreamingApi } from 'hono/streaming';

/**
 * Generates a short numeric hash from a string input.
 *
 * @param input - The input to use for generating the hash.
 *
 * @returns A numeric hash.
 */
export const generateHashSync = (input: string): number => {
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }

  return hash >>> 0;
};

export class PageStream extends SSEStreamingApi {
  /** Mutable timestamp of the last update for this stream. */
  lastUpdate: Date | null = null;
}
