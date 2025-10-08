import { init } from '@paralleldrive/cuid2';
import { EmptyFieldsError } from 'blade/server/errors';
import type { SetQueryInstructions } from 'blade/types';

/**
 * Check given object for empty values. Throws an error if the object contains
 * empty values.
 *
 * @param to Object to check for empty values.
 * @param allowed Optional array of keys to exclude. Used in cases where `null`
 * is allowed as a value.
 */
export const avoidEmptyFields = (
  to: SetQueryInstructions['to'],
  allowed?: Array<string>,
) => {
  // We'll no longer have to use `(to || {})` once the `to` property on
  // `SetQueryInstructions` is guaranteed to be defined, which it already
  // should be.
  const emptyFields = Object.keys(to || {}).filter(
    (key) =>
      !(allowed || []).includes(key) && typeof to?.[key] !== 'boolean' && !to?.[key],
  );

  if (emptyFields.length > 0) {
    throw new EmptyFieldsError({ fields: emptyFields });
  }
};

/**
 * Generate a cryptographically strong unique identifier.
 *
 * @param length Length of the identifier to generate, defaults to 24.
 *
 * @returns Cryptographically unique identifier with the specified length.
 */
export const generateUniqueId = (length = 24): string => init({ length })();

export const EMAIL_VERIFICATION_COOLDOWN = 20_000; // 20s
