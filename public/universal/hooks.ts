import { type RootTransitionOptions, usePageTransition } from '@/private/client/hooks';
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
  // @ts-expect-error The `Netlify` global only exists in the Netlify environment.
  const isNetlify = typeof Netlify !== 'undefined';
  if (typeof window === 'undefined' || isNetlify) {
    const populatePathname = usePopulatePathname();

    return (pathname: string, options?: Pick<RedirectOptions, 'extraParams'>): never => {
      const populatedPathname = populatePathname(pathname, options?.extraParams);

      throw { __blade_redirect: populatedPathname };
    };
  }

  const transitionPage = usePageTransition();
  const populatePathname = usePopulatePathname();

  return (pathname: string, options?: RedirectOptions) => {
    const populatedPathname = populatePathname(pathname, options?.extraParams);

    transitionPage(populatedPathname, 'manual', {
      immediatelyUpdateQueryParams: options?.immediatelyUpdateQueryParams,
    })();
  };
};

export { useLocation, useNavigator, useParams, usePopulatePathname, useRedirect };
