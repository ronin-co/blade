import { type AnchorHTMLAttributes, type ReactElement, cloneElement } from 'react';

import { wrapClientComponent } from '../../private/client/utils/wrap-client';
import { useUniversalContext } from '../../private/universal/hooks';
import { usePopulatePathname } from '../universal/hooks';
import { useLinkEvents } from './hooks';

interface LinkURL extends Omit<Partial<InstanceType<typeof URL>>, 'search'> {
  search?: string | Record<string, string | number | boolean | null>;
}

/**
 * Normalizes a `LinkURL` object to a `URL` instance.
 *
 * @param url - The `LinkURL` or `URL` object to normalize.
 * @param currentURL - The currently active URL.
 *
 * @returns A new `URL` instance.
 */
const normalizeURL = (url: LinkURL, currentURL: string) => {
  if (url instanceof URL) return url;

  const newURL = new URL(currentURL);

  for (const [key, value] of Object.entries(url)) {
    switch (key) {
      case 'search':
        // If the provided query parameters are serialized as a string, we can just
        // assign them to the final URL without any modifications.
        if (typeof url.search === 'string') {
          newURL.search = url.search;
          // If the provided query parameters are an object, however, we need to
          // explicitly convert them into a string.
        } else if (url.search) {
          // Filter out query parameters with `undefined` or `null` values. It's
          // important to filter out `null` because `location.searchParams` exposes query
          // params as `null` if they're empty, and `normalizeURL` should be able to
          // accept query params that were retrieved from `location.searchParams`.
          const params = Object.entries(url.search).filter(([, value]) => {
            return typeof value !== 'undefined' && value !== null;
          }) as [string, string][];

          // Generate and assign a new string of query parameters.
          newURL.search = new URLSearchParams(params).toString();
        }
        break;
      case 'hash':
      case 'host':
      case 'hostname':
      case 'href':
      case 'password':
      case 'pathname':
      case 'port':
      case 'protocol':
      case 'username':
        newURL[key] = value;
    }
  }

  return newURL;
};

/**
 * Get the pathname (including query parameters) of a URL.
 *
 * @param url - The URL to compose the pathname for.
 *
 * @returns The pathname (including query parameters) of the provided URL.
 */
const getPathFromURL = (url: LinkURL, currentURL: string) => {
  const normalized = normalizeURL(url, currentURL);
  return normalized.pathname + normalized.search;
};

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  children: ReactElement;
  href: string | LinkURL;
  segments?: Record<string, string | Array<string>>;
}

const Link = ({ href: hrefDefault, segments, children, ...extraProps }: LinkProps) => {
  const universalContext = useUniversalContext();

  const href =
    typeof hrefDefault === 'string'
      ? hrefDefault
      : getPathFromURL(hrefDefault, universalContext.url);

  const populatePathname = usePopulatePathname();
  const destination = populatePathname(href, segments);
  const linkEventHandlers = useLinkEvents(destination);

  return cloneElement(children, {
    href: destination,
    ...linkEventHandlers,
    ...extraProps,
  });
};

wrapClientComponent(Link, 'Link');

export { Link };
