import { DDL_QUERY_TYPES, DML_QUERY_TYPES_WRITE } from 'blade-compiler';

export const VERBOSE_LOGGING = import.meta.env.__BLADE_DEBUG_LEVEL === 'verbose';
export const IS_SERVER_DEV = import.meta.env.BLADE_ENV === 'development';

/** A list of all query types that update the database. */
export const WRITE_QUERY_TYPES = [
  ...DML_QUERY_TYPES_WRITE,
  ...DDL_QUERY_TYPES.filter((item) => item !== 'list'),
];
