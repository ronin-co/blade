import retry from 'async-retry';

const retryOptions = {
  // Timeouts will be [10, 60, 360, 2160, 12960] (before randomization is added)
  minTimeout: 10,
  retries: 5,
  factor: 6,
  maxRetryAfter: 20,
};

type ResponseError = Error & { body: string; statusCode: number };
type AbortError = Error & { type: string };

/**
 * Detects if the current browser has issues with stream handling that require XHR fallback
 *
 * @returns True if the browser needs XHR fallback for stream issues
 */
function needsXHRFallback(): boolean {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();

  const isSafari = /safari/.test(userAgent);
  const isChromium = /chrome|chromium/.test(userAgent);

  return isSafari && !isChromium;
}

/**
 * Extracts the URL from a request object.
 *
 * @param request - The request object (string, URL, or Request).
 *
 * @returns The extracted URL as a string.
 */
function extractXHRUrl(request: string | URL | Request): string {
  if (typeof request === 'string') return request;
  if (request instanceof URL) return request.href;
  if (request instanceof Request) return request.url;
  return String(request);
}

/**
 * XMLHttpRequest-based implementation to replace fetch for better Safari compatibility
 *
 * @param request - A URL or `Request` object.
 * @param requestInit - An optional `RequestInit` object.
 *
 * @returns A promise that resolves to an object containing the response status, statusText, headers, and text.
 */
function makeXHRRequest(
  request: Parameters<typeof fetch>[0],
  requestInit?: Parameters<typeof fetch>[1],
): Promise<{
  status: number;
  statusText: string;
  headers: Headers;
  text: string;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const url = extractXHRUrl(request);
    const method =
      request instanceof Request ? request.method : requestInit?.method || 'GET';

    xhr.open(method, url, true);

    if (requestInit?.headers) {
      const headers = new Headers(requestInit.headers);
      headers.forEach((value, key): void => xhr.setRequestHeader(key, value));
    }

    xhr.onload = (): void => {
      const headers = new Headers();
      if (xhr.getAllResponseHeaders) {
        const lines = xhr.getAllResponseHeaders().split('\r\n');
        for (const line of lines) {
          const parts = line.split(': ');
          if (parts.length === 2) {
            headers.append(parts[0], parts[1]);
          }
        }
      }

      resolve({
        headers,
        status: xhr.status,
        statusText: xhr.statusText,
        text: xhr.responseText || '',
      });
    };

    xhr.onerror = (): void => {
      reject(new Error('Network request failed'));
    };

    xhr.onabort = (): void => {
      const error = new Error('Request aborted') as AbortError;
      error.type = 'aborted';
      reject(error);
    };

    // Handle abort signal
    if (requestInit?.signal) requestInit.signal.addEventListener('abort', xhr.abort);

    xhr.send(requestInit?.body as XMLHttpRequestBodyInit);
  });
}

/**
 * Like `fetch`, except that failed requests are retried automatically and uses XMLHttpRequest for better Safari compatibility.
 *
 * @param request — A URL or `Request` object.
 * @param requestInit — An optional `Request` or `RequestInit` object.
 *
 * @returns A native `fetch` response.
 */
export const fetchRetry = async (
  request: Parameters<typeof fetch>[0],
  requestInit?: Parameters<typeof fetch>[1],
): Promise<Response> => {
  return retry(async (bail) => {
    try {
      // Note: Safari has an issue where streams are closed but the connection remains open
      // so UI flushing / revalidation will end up flickering between the current and previous
      // page.
      let response: Response;
      if (needsXHRFallback()) {
        const xhrResponse = await makeXHRRequest(request, requestInit);
        response = new Response(xhrResponse.text, {
          status: xhrResponse.status,
          statusText: xhrResponse.statusText,
          headers: xhrResponse.headers,
        });
      } else {
        response = await fetch(request, requestInit);
      }

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
