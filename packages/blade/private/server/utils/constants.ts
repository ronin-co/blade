import { DDL_QUERY_TYPES, DML_QUERY_TYPES_WRITE } from 'blade-compiler';

export const VERBOSE_LOGGING = import.meta.env.__BLADE_DEBUG_LEVEL === 'verbose';
export const IS_SERVER_DEV = import.meta.env.BLADE_ENV === 'development';

/**
 * These security headers are required to ensure a basic level of security.
 *
 * The defaults here are based on the recommended headers set in the Hono
 * `secureHeaders` middleware.
 *
 * @see https://github.com/honojs/hono/blob/bd36ad10fccf337408d732372dbdfd495c654cf2/src/middleware/secure-headers/index.ts#L67-L80
 */
export const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0',
};

/** A list of all query types that update the database. */
export const WRITE_QUERY_TYPES = [
  ...DML_QUERY_TYPES_WRITE,
  ...DDL_QUERY_TYPES.filter((item) => item !== 'list'),
];
