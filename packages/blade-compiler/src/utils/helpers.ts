import type {
  CombinedInstructions,
  Query,
  QuerySchemaType,
  QueryType,
} from '@/src/types/query';
import { MOUNTING_PATH_SUFFIX, QUERY_SYMBOLS } from '@/src/utils/constants';

/**
 * Determines the mounting path and table alias for a sub query.
 *
 * @param single - Whether a single or multiple records are being queried.
 * @param key - The key defined for `including` under which the sub query is mounted.
 * @param mountingPath - The path of a parent field under which the sub query is mounted.
 *
 * @returns A mounting path and a table alias.
 */
export const composeMountingPath = (
  single: boolean,
  key: string,
  mountingPath?: string,
): string => {
  if (key === 'ronin_root') {
    return mountingPath
      ? mountingPath.replace(
          MOUNTING_PATH_SUFFIX,
          (_, p, __, n) => `${p}{${n ? +n + 1 : 1}}`,
        )
      : key;
  }

  return `${mountingPath ? `${mountingPath}.` : ''}${single ? key : `${key}[0]`}`;
};

type CompilerErrorCode =
  | 'MODEL_NOT_FOUND'
  | 'FIELD_NOT_FOUND'
  | 'INDEX_NOT_FOUND'
  | 'TRIGGER_NOT_FOUND'
  | 'PRESET_NOT_FOUND'
  | 'INVALID_WITH_VALUE'
  | 'INVALID_TO_VALUE'
  | 'INVALID_INCLUDING_VALUE'
  | 'INVALID_FOR_VALUE'
  | 'INVALID_BEFORE_OR_AFTER_INSTRUCTION'
  | 'INVALID_MODEL_VALUE'
  | 'INVALID_FIELD_VALUE'
  | 'EXISTING_MODEL_ENTITY'
  | 'REQUIRED_MODEL_ENTITY'
  | 'MUTUALLY_EXCLUSIVE_INSTRUCTIONS'
  | 'MISSING_INSTRUCTION'
  | 'MISSING_FIELD';

export const MODEL_ENTITY_ERROR_CODES = {
  field: 'FIELD_NOT_FOUND',
  index: 'INDEX_NOT_FOUND',
  preset: 'PRESET_NOT_FOUND',
} as const;

interface Issue {
  message: string;
  path: Array<string | number>;
}

interface Details {
  message: string;
  code: CompilerErrorCode;
  field?: string;
  fields?: Array<string>;
  issues?: Array<Issue>;
  queries?: Array<Query> | null;
}

export class CompilerError extends Error {
  code: Details['code'];
  field?: Details['field'];
  fields?: Details['fields'];
  issues?: Details['issues'];
  queries?: Details['queries'];

  constructor(details: Details) {
    super(details.message);

    this.name = 'CompilerError';
    this.code = details.code;
    this.field = details.field;
    this.fields = details.fields;
    this.issues = details.issues;
    this.queries = details.queries || null;
  }
}

const SINGLE_QUOTE_REGEX = /'/g;
const DOUBLE_QUOTE_REGEX = /"/g;
const AMPERSAND_REGEX = /\s*&+\s*/g;
const SPECIAL_CHARACTERS_REGEX = /[^\w\s-]+/g;
const SPLIT_REGEX = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[\s.\-_]+/;

/**
 * Utility function to capitalize the first letter of a string while converting all other
 * letters to lowercase.
 *
 * @param str - The string to capitalize.
 *
 * @returns The capitalized string.
 */
export const capitalize = (str: string): string => {
  if (!str || str.length === 0) return '';

  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Utility function to sanitize a given string.
 *
 * - Removes single quotes.
 * - Removes double quotes.
 * - Replaces `&` with `and`.
 * - Replaces special characters with spaces.
 * - Strips leading and trailing whitespace.
 *
 * @param str - The string to sanitize.
 *
 * @returns The sanitized string.
 */
const sanitize = (str: string): string => {
  if (!str || str.length === 0) return '';

  return (
    str
      // Remove single quotes from the string.
      .replace(SINGLE_QUOTE_REGEX, '')
      // Remove double quotes from the string.
      .replace(DOUBLE_QUOTE_REGEX, '')
      // Replace `&` with `and`.
      .replace(AMPERSAND_REGEX, ' and ')
      // Replace special characters with spaces.
      .replace(SPECIAL_CHARACTERS_REGEX, ' ')
      // Strip leading and trailing whitespace.
      .trim()
  );
};

/**
 * Utility function to convert a given string to snake-case.
 *
 * @param str - The string to convert.
 *
 * @returns The converted string.
 */
export const convertToSnakeCase = (str: string): string => {
  if (!str || str.length === 0) return '';

  return sanitize(str)
    .split(SPLIT_REGEX)
    .map((part) => part.toLowerCase())
    .join('_');
};

/**
 * Utility function to convert a given string to camel-case.
 *
 * @param str - The string to convert.
 *
 * @returns The converted string.
 */
export const convertToCamelCase = (str: string): string => {
  if (!str || str.length === 0) return '';

  return sanitize(str)
    .split(SPLIT_REGEX)
    .map((part, index) => (index === 0 ? part.toLowerCase() : capitalize(part)))
    .join('');
};

/**
 * Utility function to check if the given value is an object.
 *
 * @param value - Object-like value to check.
 */
export const isObject = (value: unknown): boolean =>
  value != null && typeof value === 'object' && Array.isArray(value) === false;

/**
 * Checks if the provided value contains a RONIN model symbol (a represenation of a
 * particular entity inside a query, such as an expression or a sub query) and returns
 * its type and value.
 *
 * @param value - The value that should be checked.
 *
 * @returns The type and value of the symbol, if the provided value contains one.
 */
export const getQuerySymbol = (
  value: unknown,
):
  | {
      type: 'query';
      value: Query;
    }
  | {
      type: 'expression';
      value: string;
    }
  | null => {
  if (!isObject(value)) return null;

  const objectValue = value as
    | Record<typeof QUERY_SYMBOLS.QUERY, Query>
    | Record<typeof QUERY_SYMBOLS.EXPRESSION, string>;

  if (QUERY_SYMBOLS.QUERY in objectValue) {
    return {
      type: 'query',
      value: objectValue[QUERY_SYMBOLS.QUERY],
    };
  }

  if (QUERY_SYMBOLS.EXPRESSION in objectValue) {
    return {
      type: 'expression',
      value: objectValue[QUERY_SYMBOLS.EXPRESSION],
    };
  }

  return null;
};

/**
 * Finds all string values that match a given pattern in an object. If needed, it also
 * replaces them.
 *
 * @param obj - The object in which the string values should be found.
 * @param pattern - The string that values can start with.
 * @param replacer - A function that returns the replacement value for each match.
 *
 * @returns Whether the pattern was found in the object.
 */
export const findInObject = (
  obj: NestedObject,
  pattern: string,
  replacer?: (match: string) => string,
): boolean => {
  let found = false;

  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) continue;

    const value = obj[key];

    if (isObject(value)) {
      found = findInObject(value as NestedObject, pattern, replacer);

      // We're purposefully using `.startsWith` instead of a regex here, because we only
      // want to replace the value if it starts with the pattern, so a regex would be
      // unnecessary performance overhead.
    } else if (typeof value === 'string' && value.startsWith(pattern)) {
      found = true;

      if (replacer) {
        obj[key] = value.replace(pattern, replacer);
      } else {
        return found;
      }
    }
  }

  return found;
};

type NestedObject = {
  [key: string]: unknown | NestedObject;
};

/**
 * Converts an object of nested objects into a flat object, where all keys sit on the
 * same level (at the root).
 *
 * @param obj - The object that should be flattened.
 * @param prefix - An optional path of a nested field to begin the recursion from.
 * @param res - The object that the flattened object should be stored in.
 *
 * @returns A flattened object.
 */
export const flatten = (
  obj: NestedObject,
  prefix = '',
  res: NestedObject = {},
): NestedObject => {
  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null && !getQuerySymbol(value)) {
      flatten(value as NestedObject, path, res);
    } else {
      res[path] = value;
    }
  }
  return res;
};

/**
 * Omits properties from an object.
 *
 * @param obj - The object from which properties should be omitted.
 * @param properties - The properties that should be omitted.
 *
 * @returns The object without the omitted properties.
 */
export const omit = <T, K extends keyof T>(obj: T, properties: Array<K>): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(obj as object).filter(([key]) => !properties.includes(key as K)),
  ) as Omit<T, K>;

/**
 * Picks a property from an object and returns the value of the property.
 *
 * @param obj - The object from which the property should be read.
 * @param path - The path at which the property should be read.
 *
 * @returns The value of the property.
 */
export const getProperty = (obj: NestedObject, path: string): unknown => {
  return path.split('.').reduce((acc, key) => acc?.[key] as NestedObject, obj);
};

/**
 * Splits a path string into an array of path segments.
 *
 * @param path - The path string (supports both dot and bracket notation).
 *
 * @returns An array of path segments.
 */
export const getPathSegments = (path: string): Array<string> => {
  return path.split(/[.[\]]/g).filter((segment) => segment.trim().length > 0);
};

/**
 * Sets a property on an object by mutating the object in place.
 *
 * @param obj - The object on which the property should be set.
 * @param path - The path at which the property should be set.
 * @param value - The value of the property.
 *
 * @returns Nothing.
 */
export const setProperty = <Object = NestedObject>(
  obj: Object,
  path: string,
  value: unknown,
): void => {
  const segments = getPathSegments(path);

  const _set = (node: NestedObject): void => {
    if (segments.length > 1) {
      const key = segments.shift() as string;
      const nextIsNum = !Number.isNaN(Number.parseInt(segments[0]));

      // If the current property is not an object or array, overwrite it.
      if (typeof node[key] !== 'object' || node[key] === null) {
        node[key] = nextIsNum ? [] : {};
      }

      _set(node[key] as NestedObject);
    } else {
      node[segments[0]] = value;
    }
  };

  _set(obj as NestedObject);
};

/**
 * Deletes a property from an object by mutating the object in place. Additionally, if
 * after deletion, any parent objects become empty, those empty objects are also deleted.
 *
 * @param obj - The object from which the property should be deleted.
 * @param path - The path at which the property should be deleted.
 *
 * @returns Nothing.
 */
export const deleteProperty = <Object = NestedObject>(
  obj: Object,
  path: string,
): void => {
  const segments = getPathSegments(path);

  const _delete = (node: NestedObject, segs: Array<string>): boolean => {
    const key = segs[0];

    if (segs.length === 1) {
      // Delete the final property.
      delete node[key];
    } else if (node[key] && typeof node[key] === 'object' && node[key] !== null) {
      // Recurse down the path.
      const shouldCleanup = _delete(node[key] as NestedObject, segs.slice(1));
      // If the child object is now empty, delete it.
      if (shouldCleanup) delete node[key];
    }

    // Return `true` if this node is an object and now empty.
    return Object.keys(node).length === 0;
  };

  _delete(obj as NestedObject, segments);
};

/**
 * Splits a query into its type, model, and instructions.
 *
 * @param query - The query to split.
 *
 * @returns The type, model, and instructions of the provided query.
 */
export const splitQuery = (
  query: Query,
): {
  queryType: QueryType;
  queryModel: string;
  queryInstructions: CombinedInstructions;
} => {
  // The type of query that is being executed (`add`, `get`, etc).
  const queryType = Object.keys(query)[0] as QueryType;

  // The slug or plural slug of the RONIN model that the query will interact with.
  const queryModel = Object.keys(query[queryType] as QuerySchemaType)[0];

  // The instructions of the query (`with`, `including`, etc).
  const queryInstructions = (query[queryType] as QuerySchemaType)[
    queryModel
  ] as CombinedInstructions;

  return { queryType, queryModel, queryInstructions };
};
