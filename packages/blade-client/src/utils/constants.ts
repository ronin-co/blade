import { DDL_QUERY_TYPES, DML_QUERY_TYPES_WRITE } from 'blade-compiler';

/** A list of all query types that update the database. */
export const WRITE_QUERY_TYPES = [
  ...DML_QUERY_TYPES_WRITE,
  ...DDL_QUERY_TYPES.filter((item) => item !== 'list'),
];
