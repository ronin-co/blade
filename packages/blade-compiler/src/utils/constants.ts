/** Query types used for reading data. */
export const DML_QUERY_TYPES_READ = ['get', 'count'] as const;

/** Query types used for writing data. */
export const DML_QUERY_TYPES_WRITE = ['set', 'add', 'remove'] as const;

/** Query types used for interacting with data. */
export const DML_QUERY_TYPES = [
  ...DML_QUERY_TYPES_READ,
  ...DML_QUERY_TYPES_WRITE,
] as const;

/** Query types used for reading the database schema. */
export const DDL_QUERY_TYPES_READ = ['list'] as const;

/** Query types used for writing the database schema. */
export const DDL_QUERY_TYPES_WRITE = ['create', 'alter', 'drop'] as const;

/** Query types used for interacting with the database schema. */
export const DDL_QUERY_TYPES = [
  ...DDL_QUERY_TYPES_READ,
  ...DDL_QUERY_TYPES_WRITE,
] as const;

/** All read query types. */
export const QUERY_TYPES_READ = [
  ...DML_QUERY_TYPES_READ,
  ...DDL_QUERY_TYPES_READ,
] as const;

/** All write query types. */
export const QUERY_TYPES_WRITE = [
  ...DML_QUERY_TYPES_WRITE,
  ...DDL_QUERY_TYPES_WRITE,
] as const;

/** All query types. */
export const QUERY_TYPES = [...DML_QUERY_TYPES, ...DDL_QUERY_TYPES] as const;

/**
 * A list of placeholders that can be located inside queries after those queries were
 * serialized into JSON objects.
 *
 * These placeholders are used to represent special keys and values. For example, if a
 * query is nested into a query, the nested query will be marked with `__RONIN_QUERY`,
 * which allows for distinguishing that nested query from an object of instructions.
 */
export const QUERY_SYMBOLS = {
  // Represents a sub query.
  QUERY: '__RONIN_QUERY',

  // Represents an expression that should be evaluated.
  EXPRESSION: '__RONIN_EXPRESSION',

  // Represents the value of a field in the model.
  FIELD: '__RONIN_FIELD_',

  // Represents the value of a field in the model of a parent query.
  FIELD_PARENT: '__RONIN_FIELD_PARENT_',

  // Represents a value provided to a query preset.
  VALUE: '__RONIN_VALUE',
} as const;

/**
 * A regular expression for matching the symbol that represents a field of a model.
 */
export const RONIN_MODEL_FIELD_REGEX = new RegExp(
  `${QUERY_SYMBOLS.FIELD}[_a-zA-Z0-9.]+`,
  'g',
);

// JavaScript types that can directly be used as field types in RONIN.
export const RAW_FIELD_TYPES = ['string', 'number', 'boolean'] as const;
export type RawFieldType = (typeof RAW_FIELD_TYPES)[number];

// An expression that produces a timestamp in the format "YYYY-MM-DDTHH:MM:SS.SSSZ",
// which matches the output of `new Date().toISOString()` in JavaScript (ISO 8601).
export const CURRENT_TIME_EXPRESSION = {
  [QUERY_SYMBOLS.EXPRESSION]: `strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'`,
};

// A regular expression for splitting up the components of a field mounting path, meaning
// the path within a record under which a particular field's value should be mounted.
export const MOUNTING_PATH_SUFFIX = /(.*?)(\{(\d+)\})?$/;
