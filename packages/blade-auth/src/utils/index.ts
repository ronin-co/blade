import { EmptyFieldsError, InvalidPermissionsError } from 'blade/errors';
import { type JWTPayload, verifyJWT } from 'blade/server/utils';
import type { SetQueryInstructions, TriggerOptions } from 'blade/types';

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

export const AUTH_SECRET =
  import.meta.env?.BLADE_AUTH_SECRET ||
  (import.meta.env?.BLADE_ENV === 'development' ? 'default-secret-1234' : '');

// The `import` check here prevents the error from showing when commands like
// `blade diff` load the models, which might contain models exposed by `blade-auth` and
// therefore also the current file.
if (!AUTH_SECRET && typeof import.meta.env !== 'undefined')
  throw new Error('Please add a `BLADE_AUTH_SECRET` environment variable.');

/**
 * Retrieve the account that authored the incoming query.
 *
 * @param cookies - The list of cookies provided to the trigger.
 *
 * @returns The ID of the account that authored the incoming query.
 */
export const getSessionCookie = async (
  cookies: TriggerOptions['cookies'],
): Promise<JWTPayload> => {
  const token = cookies.session;

  let sessionId: string | null = null;
  let accountId: string | null = null;

  if (token) {
    try {
      const tokenPayload = await verifyJWT(token, AUTH_SECRET);

      sessionId = (tokenPayload?.sub as string) || null;
      accountId = (tokenPayload?.aud as string) || null;
    } catch (err) {
      console.warn(`Failed to decode token: \`${(err as Error).message}\``);
    }
  }

  if (!(sessionId && accountId)) {
    throw new InvalidPermissionsError({
      message: 'No session provided for authentication.',
    });
  }

  return { sessionId, accountId };
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
