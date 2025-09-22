import retry from 'async-retry';

const retryOptions = {
  // Timeouts will be [10, 60, 360, 2160, 12960] (before randomization is added)
  minTimeout: 10,
  retries: 5,
  factor: 6,
  maxRetryAfter: 20,
};

type ResponseError = Error & { body: string; statusCode: number };

/**
 * Like `fetch`, except that failed requests are retried automatically.
 *
 * @param request - A URL or `Request` object.
 * @param requestInit - An optional `Request` or `RequestInit` object.
 *
 * @returns A native `fetch` response.
 */
export const fetchRetry = async (
  request: Parameters<typeof fetch>[0],
  requestInit?: Parameters<typeof fetch>[1],
): Promise<Response> => {
  return retry(async (bail) => {
    try {
      const response = await fetch(request, requestInit);

      if ((response.status >= 500 && response.status < 600) || response.status === 429) {
        const retryAfter = response.headers.has('retry-after')
          ? Number.parseInt(response.headers.get('retry-after') as string, 10)
          : null;

        if (retryAfter) {
          if (retryAfter > retryOptions.maxRetryAfter) {
            return response;
          }

          await new Promise((r) => {
            setTimeout(r, retryAfter * 1e3);
          });
        }

        const error = new Error(response.statusText) as ResponseError;
        error.body = await response.text();
        error.statusCode = response.status;
        throw error;
      }

      return response;
    } catch (err: unknown) {
      const error = err as Error & { type: string };

      if (error.type === 'aborted') {
        return bail(error);
      }

      throw err;
    }
  }) as Promise<Response>;
};
