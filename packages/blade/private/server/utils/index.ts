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
  /** The incoming url of the page that is being viewed. */
  url: URL;
  /** The incoming headers of the request that created the stream. */
  readonly headers: Headers;
  /**
   * The time at which the last update was sent by the server (excludes revalidation).
   * If the value is `null`, no update was sent yet.
   */
  lastUpdate: Date | null = null;
  /** The first response object returned to the client. */
  readonly response: Response;

  constructor(page: { url: URL; headers: Headers }) {
    const { readable, writable } = new TransformStream();

    super(writable, readable);

    this.url = page.url;
    this.headers = page.headers;

    this.response = new Response(this.responseReadable, {
      headers: {
        'Transfer-Encoding': 'chunked',
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  /**
   * Consumes a `Response`, which is converted into a chunk on the current stream.
   *
   * @param type - The type of chunk that should be sent.
   * @param response - The response that should be consumed.
   *
   * @returns A `Promise` that will resolve once the chunk has been flushed.
   */
  writeChunk(type: 'update' | 'update-bundle', response: Response) {
    // Migrate the headers to the final response.
    for (const headerKey in response.headers) {
      const headerValue = response.headers.get(headerKey);
      this.response.headers.set(headerKey, headerValue!);
    }

    return this.writeSSE({
      id: `${crypto.randomUUID()}-${import.meta.env.__BLADE_BUNDLE_ID}`,
      event: type,
      data: response.text(),
    });
  }
}
