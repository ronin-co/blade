import type { CompilerError, Query } from 'blade-compiler';
import { StatementExecutionError } from 'hive/sdk/errors';

interface ClientErrorDetails {
  message: string;
  // Since compiler errors might get returned by the platform, we have to add them here.
  // The `AUTH_INVALID_ACCESS` error might be returned by the platform.
  code:
    | 'JSON_PARSE_ERROR'
    | 'TRIGGER_REQUIRED'
    | 'AUTH_INVALID_ACCESS'
    | 'QUERY_EXECUTION_FAILED'
    | CompilerError['code'];
  query?: Query;
}

export class ClientError extends Error {
  message: ClientErrorDetails['message'];
  code: ClientErrorDetails['code'];
  query: ClientErrorDetails['query'];

  constructor(details: ClientErrorDetails) {
    super(details.message);

    this.name = 'ClientError';
    this.message = details.message;
    this.code = details.code;
    this.query = details.query;
  }
}

export { StatementExecutionError };

/**
 * Parses the response as JSON or, alternatively, throws an error containing
 * potential error details that might have been included in the response.
 *
 * @param response - The response of a fetch request.
 *
 * @returns The response body as a JSON object.
 */
export const getResponseBody = async <T>(
  response: Response,
  options?: { errorPrefix?: string },
): Promise<T> => {
  // If the response is okay, we want to parse the JSON asynchronously.
  if (response.ok) return response.json() as T;

  const text = await response.text();

  let json: T & {
    error?: ClientErrorDetails;
  };

  try {
    json = JSON.parse(text);
  } catch (_err) {
    throw new ClientError({
      message: `${options?.errorPrefix ? `${options.errorPrefix} ` : ''}${text}`,
      code: 'JSON_PARSE_ERROR',
    });
  }

  if (json.error) {
    json.error.message = `${options?.errorPrefix ? `${options.errorPrefix} ` : ''}${json.error.message}`;
    throw new ClientError(json.error);
  }

  return json;
};
