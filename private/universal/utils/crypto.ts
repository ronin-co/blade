import { init } from '@paralleldrive/cuid2';

/**
 * Generate cryptographically strong unique identifiers.
 *
 * @param length - The length of the identifier to generate; defaults to 10.
 *
 * @returns A unique identifier.
 */
export const generateUniqueId = (length = 10): string => init({ length })();
