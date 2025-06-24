import { Image as ImageComponent } from '@ronin/react';
import { type AnchorHTMLAttributes, type ReactElement, cloneElement } from 'react';

import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import { useUniversalContext } from '@/private/universal/hooks';
import { useLinkEvents } from '@/public/client/hooks';
import { usePopulatePathname } from '@/public/universal/hooks';

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
  prefetch?: boolean;
}

const Link = ({
  href: hrefDefault,
  segments,
  children,
  prefetch = true,
  ...extraProps
}: LinkProps) => {
  const universalContext = useUniversalContext();

  const href =
    typeof hrefDefault === 'string'
      ? hrefDefault
      : getPathFromURL(hrefDefault, universalContext.url);

  const populatePathname = usePopulatePathname();
  const destination = populatePathname(href, segments);
  const linkEventHandlers = useLinkEvents(destination);

  const shouldPrefetch =
    prefetch &&
    !(destination.startsWith('https://') || destination.startsWith('http://'));

  const eventHandlers = shouldPrefetch
    ? linkEventHandlers
    : { onClick: linkEventHandlers.onClick };

  return cloneElement(children, {
    href: destination,
    ...eventHandlers,
    ...extraProps,

    // We must pass `extraProps` after `linkEventHandlers`, to allow for overwriting the
    // default event handlers.
    //
    // However, simply deconstructing `extraProps` after deconstructing
    // `linkEventHandlers` would cause props within `extraProps` to overwrite the props
    // in `linkEventHandlers`, even if the props in `extraProps` contain the value
    // `undefined`. To protect against this, we are explicitly checking whether the value
    // is falsy before using it.
    onClick: extraProps.onClick || linkEventHandlers.onClick,
    onMouseEnter: extraProps.onMouseEnter || linkEventHandlers.onMouseEnter,
    onTouchStart: extraProps.onTouchStart || linkEventHandlers.onTouchStart,
  });
};

// We need to assign the component to a variable, otherwise `tsup` will remove the export
// below and try to export it directly from the import, so `wrapClientComponent` would not
// apply to it.
const Image: typeof ImageComponent = ImageComponent;

wrapClientComponent(Link, 'Link');
wrapClientComponent(Image, 'Image');

export { Link, Image };
