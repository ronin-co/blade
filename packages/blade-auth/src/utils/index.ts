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
 * Generate pseudo-random unique identifiers.
 *
 * @returns A unique identifier.
 */
export const generateUniqueId = (): string => {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString();
};

export const EMAIL_VERIFICATION_COOLDOWN = 20_000; // 20s
