import type { CookieSerializeOptions } from 'cookie';
import { useContext } from 'react';

import { type RootTransitionOptions, usePageTransition } from '@/private/client/hooks';
import { RootServerContext } from '@/private/server/context';
import { usePrivateLocation, useUniversalContext } from '@/private/universal/hooks';
import type { CustomNavigator } from '@/private/universal/types/util';
import { populatePathSegments } from '@/private/universal/utils/paths';

const useParams = <
  TParams extends Record<string, unknown> | Array<string> = Record<
    string,
    string | Array<string>
  >,
  TResult extends Record<string, unknown> | Array<string> = TParams extends Array<string>
    ? { [K in TParams[number]]: string }
    : TParams,
>(): TResult => useUniversalContext().params as TResult;

const useLocation = (): URL => {
  const newLocation = usePrivateLocation();

  // Since the `?page` query param should only be managed by BLADE internally and never
  // by the application code, we need to remove it from the URL before making the URL
  // available to the application code.
  //
  // This is also helpful because it ensures that, whenever the application code takes the
  // current location, applies query params, and then sets the new location based on the
  // old one, the `?page` query param will be removed as a result. For example, if the
  // application code sets a `?search` query param, the `?page` query param would
  // automatically be removed.
  newLocation.searchParams.delete('page');

  return newLocation;
};

const useNavigator = (): CustomNavigator => {
  const universalContext = useUniversalContext();

  return {
    userAgent: universalContext.userAgent,
    geoLocation: universalContext.geoLocation,
    languages: universalContext.languages,
  };
};

const usePopulatePathname = () => {
  const params = useParams();

  return (pathname: string, extraParams?: { [key: string]: string | string[] }) => {
    return populatePathSegments(pathname, Object.assign({}, params, extraParams));
  };
};

interface RedirectOptions
  extends Pick<RootTransitionOptions, 'immediatelyUpdateQueryParams'> {
  /**
   * Extra parameters to be used when populating the pathname.
   *
   * For example, if the pathname passed to `redirect` is `/user/[id]`, and `extraParams`
   * contains `id: '123'`, the resulting pathname will automatically be `/user/123`.
   */
  extraParams?: { [key: string]: string };
}

const useRedirect = () => {
  const populatePathname = usePopulatePathname();

  // @ts-expect-error The `Netlify` global only exists in the Netlify environment.
  const isNetlify = typeof Netlify !== 'undefined';
  if (typeof window === 'undefined' || isNetlify) {
    return (pathname: string, options?: Pick<RedirectOptions, 'extraParams'>): never => {
      const populatedPathname = populatePathname(pathname, options?.extraParams);

      throw { __blade_redirect: populatedPathname };
    };
  }

  const transitionPage = usePageTransition();

  return (pathname: string, options?: RedirectOptions) => {
    const populatedPathname = populatePathname(pathname, options?.extraParams);

    transitionPage(populatedPathname, 'manual', {
      immediatelyUpdateQueryParams: options?.immediatelyUpdateQueryParams,
    })();
  };
};

export type CookieHookOptions = {
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
};

// 365 days
const DEFAULT_COOKIE_MAX_AGE = 31536000;

const useCookie = <T extends string | null>(
  name: string,
): [T | null, (value: T, options?: CookieHookOptions) => void] => {
  // @ts-expect-error The `Netlify` global only exists in the Netlify environment.
  const isNetlify = typeof Netlify !== 'undefined';
  if (typeof window === 'undefined' || isNetlify) {
    const serverContext = useContext(RootServerContext);
    if (!serverContext) throw new Error('Missing server context in `useCookie`');

    const { cookies, collected } = serverContext;
    const value = cookies[name] as T | null;

    const setValue = (value: T, options?: CookieHookOptions) => {
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
        value,
        ...cookieSettings,
      };
    };

    return [value, setValue];
  }

  const value =
    (document.cookie.match(`(^|;)\\s*${name}=([^;]*)`)?.pop() as T | undefined) || null;

  const setValue = (value: T, options?: CookieHookOptions) => {
    const shouldDelete = value === null;
    const encodedValue = shouldDelete ? '' : encodeURIComponent(value);

    const components = [`${encodeURIComponent(name)}=${encodedValue}`];

    if (shouldDelete) {
      components.push('expires=Thu, 01 Jan 1970 00:00:00 GMT');
    } else {
      components.push(`max-age=${DEFAULT_COOKIE_MAX_AGE}`);
    }

    if (options?.path) components.push(`path=${options.path}`);

    document.cookie = components.join('; ');
  };

  return [value, setValue];
};

export {
  useLocation,
  useNavigator,
  useParams,
  usePopulatePathname,
  useRedirect,
  useCookie,
};
