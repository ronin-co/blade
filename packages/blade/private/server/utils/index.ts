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

export class ResponseStream extends SSEStreamingApi {
  /**
   * The time at which the last update was sent by the server (excludes revalidation).
   * If the value is `null`, no update was sent yet.
   */
  lastUpdate: Date | null = null;
  /** The first request object provided by the client. */
  request: Request;
  /** The first response object returned to the client. */
  readonly response: Response;

  /** Allows for tracking whether the response is ready to be returned. */
  readonly headersReady: Promise<void>;
  private setHeadersReady!: () => void;
  private headersMarkedReady = false;

  constructor(request: Request) {
    const { readable, writable } = new TransformStream();
    super(writable, readable);

    // Create a fresh request with only the URL and headers, since we will modify the
    // headers and runtimes like `workerd` don't allow that on the incoming request.
    const newRequest = new Request(request.url, { headers: request.headers });

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

    this.headersReady = new Promise<void>((resolve) => {
      this.setHeadersReady = () => {
        if (this.headersMarkedReady) return;

        this.headersMarkedReady = true;
        resolve();
      };
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
    response.headers.forEach((value, key) => this.response.headers.set(key, value));

    // Inform any outside watchers that the response now has headers and can be returned,
    // such that the response is returned to the client even before the first body chunk
    // is being flushed further below.
    this.setHeadersReady();

    // If the URL of the page changed while it was rendered (for example because of a
    // redirect), we have to update the session URL accordingly.
    //
    // In the case that an initial redirect (`Location` header) was performed, we don't
    // need to update the session URL, because the client will terminate the stream in
    // that case anyways (that's just default browser behavior).
    const newURL = response.headers.get('Content-Location');
    if (newURL) {
      this.request = new Request(new URL(newURL, this.request.url), this.request);
    }

    return this.writeSSE({
      id: `${crypto.randomUUID()}-${import.meta.env.__BLADE_BUNDLE_ID}`,
      event: type,
      data: response.text(),
    });
  }
}
