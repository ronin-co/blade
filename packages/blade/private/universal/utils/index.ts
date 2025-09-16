import type { CookieSerializeOptions } from 'cookie';

import type { ServerContext } from '@/private/server/context';
import { DEFAULT_COOKIE_MAX_AGE } from '@/private/universal/utils/constants';

/**
 * Generate pseudo-random unique identifiers.
 *
 * @returns A unique identifier.
 */
export const generateUniqueId = (): string => {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString();
};

export type SetExistingCookie<T> = (value: T, options?: CookieOptions) => void;
export type SetCookie<T> = (
  name: string,
  ...rest: Parameters<SetExistingCookie<T>>
) => void;

interface CookieOptions {
  /**
   * Allows for making cookies accessible to the client, instead of allowing only the
   * server to read and modify them.
   */
  client?: true;
  /**
   * Allows for restricting the cookie to a specific URL path of the app.
   *
   * @default '/'
   */
  path?: string;
}

/**
 * Generates a function that can be used to set new cookies.
 *
 * @param collected - The list of all collected resources in the server context.
 *
 * @returns The function that can be used for setting cookies.
 */
export const getCookieSetter = <T>(
  collected: ServerContext['collected'],
): SetCookie<T> => {
  return (name, value, options) => {
    const cookieSettings: CookieSerializeOptions = {
      // 365 days.
      maxAge: DEFAULT_COOKIE_MAX_AGE,
      httpOnly: !options?.client,
      path: options?.path || '/',
    };

    // To delete cookies, we have to set their expiration time to the past.
    if (value === null) {
      cookieSettings.expires = new Date(Date.now() - 1000000);
      delete cookieSettings.maxAge;
    }
    // As per the types defined for the surrounding function, this condition would never
    // be met. But we'd like to keep it regardless, to catch cases where the types
    // provided to the developer aren't smart enough to avoid `undefined` or similar
    // getting passed.
    else if (typeof value !== 'string') {
      let message = 'Cookies can only be set to a string value, or `null` ';
      message += `for deleting them. Please adjust "${name}".`;
      throw new Error(message);
    }

    if (!collected.cookies) collected.cookies = {};

    collected.cookies[name] = {
      value: value as string | null,
      ...cookieSettings,
    };
  };
};
