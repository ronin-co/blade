import { expression } from '@/src/helpers/expressions';
import { QUERY_SYMBOLS, getQuerySymbol } from '@ronin/compiler';

/**
 * Wraps a raw SQL expression as-is.
 * Use with caution as this bypasses SQL injection protection.
 *
 * @param expressions - The raw SQL expression to use.
 *
 * @returns The wrapped SQL expression
 */
export const sql = (expressions: string): any => expression<any>(expressions);

/**
 * Generates a pseudo-random integer between -9223372036854775808 and +9223372036854775807.
 *
 * @returns SQL expression that evaluates to a random number.
 */
export const random = (): number => expression<number>('random()');

/**
 * Calculates the absolute value of a number.
 *
 * @param value - The number to get absolute value of.
 *
 * @returns SQL expression that evaluates to the absolute value.
 */
export const abs = (value: number | Record<string, string | number>): number => {
  const valueExpression =
    typeof value === 'object' && QUERY_SYMBOLS.EXPRESSION in value
      ? value[QUERY_SYMBOLS.EXPRESSION]
      : value;

  return expression<number>(`abs(${valueExpression})`);
};

/**
 * Formats a timestamp according to the specified format string.
 *
 * @param format - The format string (e.g. '%Y-%m-%d').
 * @param timestamp - The timestamp to format, or 'now' for current time.
 *
 * @returns SQL expression that evaluates to the formatted timestamp.
 */
export const strftime = (format: string, timestamp: string | 'now'): Date =>
  expression<Date>(`strftime('${format}', '${timestamp}')`);

/**
 * Extracts a value from a JSON document at the specified path.
 *
 * @param json - The JSON document to extract from.
 * @param path - The path to extract the value from.
 *
 * @returns SQL expression that evaluates to the extracted value.
 */
export const json_extract = (json: string, path: string): string =>
  expression<string>(`json_extract('${json}', '${path}')`);

/**
 * Applies a JSON patch operation to a JSON document.
 *
 * @param patch - The JSON patch document defining the modifications.
 * @param input - The JSON document to patch.
 *
 * @returns SQL expression that evaluates to the patched JSON document.
 */
export const json_patch = (patch: string, input: string): string =>
  expression<string>(`json_patch('${patch}', '${input}')`);

/**
 * Sets a value in a JSON document at the specified path.
 * Creates the path if it doesn't exist and overwrites if it does.
 *
 * @param json - The JSON document to modify.
 * @param path - The path to set the value at.
 * @param value - The value to set.
 *
 * @returns SQL expression that evaluates to the modified JSON document.
 */
export const json_set = (json: string, path: string, value: string): string =>
  expression<string>(`json_set('${json}', '${path}', '${value}')`);

/**
 * Replaces a value in a JSON document at the specified path.
 * Only modifies existing paths, will not create new ones.
 *
 * @param json - The JSON document to modify.
 * @param path - The path to replace the value at.
 * @param value - The new value.
 *
 * @returns SQL expression that evaluates to the modified JSON document.
 */
export const json_replace = (json: string, path: string, value: string): string =>
  expression<string>(`json_replace('${json}', '${path}', '${value}')`);

/**
 * Inserts a value into a JSON document at the specified path.
 * Only creates new paths, will not modify existing ones.
 *
 * @param json - The JSON document to modify.
 * @param path - The path to insert the value at.
 * @param value - The value to insert.
 *
 * @returns SQL expression that evaluates to the modified JSON document.
 */
export const json_insert = (json: string, path: string, value: string): string =>
  expression<string>(`json_insert('${json}', '${path}', '${value}')`);

/**
 * Concatenates a list of strings together.
 *
 * @param values - The list of strings to concatenate.
 *
 * @returns An expression representing the concatenated string.
 */
export const concat = (
  ...values: Array<string | unknown | Record<typeof QUERY_SYMBOLS.EXPRESSION, string>>
): string => {
  const formattedValues = values.map((value) => {
    const symbol = getQuerySymbol(value);
    return symbol?.type === 'expression' ? symbol.value : `'${value}'`;
  });

  return expression<string>(`concat(${formattedValues.join(', ')})`);
};

/**
 * Replaces all occurrences of a substring within a string with a replacement value.
 *
 * @param input - The string to perform replacements on.
 * @param search - The substring to search for.
 * @param replacement - The string to replace matches with.
 *
 * @returns SQL expression that evaluates to the modified string.
 */
export const replace = (input: string, search: string, replacement: string): string =>
  expression<string>(`replace('${input}', '${search}', '${replacement}')`);
