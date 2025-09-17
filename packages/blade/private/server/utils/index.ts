import { SSEStreamingApi } from 'hono/streaming';

import { CUSTOM_HEADERS } from '@/private/universal/utils/constants';

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
  /**
   * The time at which the last update was sent by the server (excludes revalidation).
   * If the value is `null`, no update was sent yet.
   */
  lastUpdate: Date | null = null;
  /** The first request object provided by the client. */
  request: Request;
  /** The first response object returned to the client. */
  readonly response: Response;

  constructor(request: Request) {
    const { readable, writable } = new TransformStream();
    super(writable, readable);

    // Clone the request (and drop the body from memory) since we will modify the headers,
    // and runtimes like `workerd` don't allow modifying the incoming request.
    const newRequest = new Request(request, { body: null });

    // Remove meta headers from the incoming headers.
    Object.values(CUSTOM_HEADERS).forEach((header) => newRequest.headers.delete(header));

    this.request = newRequest;

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

    // If the URL of the page changed while it was rendered (for example because of a
    // redirect), we have to update the session URL accordingly.
    //
    // In the case that an initial redirect (`Location` header) was performed, we don't
    // need to update the session URL, because the client will terminate the stream in
    // that case anyways (that's just default browser behavior).
    const newURL = response.headers.get('Content-Location');
    if (newURL) this.request = new Request(newURL, this.request);

    return this.writeSSE({
      id: `${crypto.randomUUID()}-${import.meta.env.__BLADE_BUNDLE_ID}`,
      event: type,
      data: response.text(),
    });
  }
}
