const SINGLE_QUOTE_REGEX = /'/g;
const DOUBLE_QUOTE_REGEX = /"/g;
const AMPERSAND_REGEX = /\s*&+\s*/g;
const SPECIAL_CHARACTERS_REGEX = /[^\w\s-]+/g;
const SPLIT_REGEX = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[\s.\-_]+/;

/**
 * Utility function to capitalize the first letter of a string while converting
 * all other letters to lowercase.
 *
 * Intended for internal use only.
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
 * Intended for internal use only.
 *
 * @param str – The string to sanitize.
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
 * Utility function to convert a given string to pascal-case.
 *
 * @param str – The string to convert.
 *
 * @returns The converted string.
 */
export const convertToPascalCase = (str: string): string => {
  if (!str || str.length === 0) return '';

  return sanitize(str).split(SPLIT_REGEX).map(capitalize).join('');
};
