import type { AnchorHTMLAttributes, FunctionComponent, ReactNode } from 'react';

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
  return normalized.pathname + normalized.search + normalized.hash;
};

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  children: ReactNode;
  href: string | LinkURL;
  segments?: Record<string, string | Array<string>>;
  prefetch?: boolean;
}

const Link: FunctionComponent<LinkProps> = ({
  href: hrefDefault,
  segments,
  children,
  prefetch = true,
  ...extraProps
}) => {
  const universalContext = useUniversalContext();

  const href =
    typeof hrefDefault === 'string'
      ? hrefDefault
      : getPathFromURL(hrefDefault, universalContext.url);

  const populatePathname = usePopulatePathname();
  const destination = populatePathname(href, segments);
  const linkEventHandlers = useLinkEvents(destination);

  const isExternal = href.startsWith('https://') || href.startsWith('http://');

  let eventHandlers: typeof linkEventHandlers | undefined = prefetch
    ? linkEventHandlers
    : {
        onClick: linkEventHandlers.onClick,
        onMouseEnter: undefined,
        onTouchStart: undefined,
      };

  // If the provided `href` does not require a page to be retrieved by Blade, we want to
  // let the browser handle the link events for maximum efficiency.
  //
  // Specifically, this is necesary if the provided `href` is only a hash (like `#test`)
  // or contains an external URL, meaning a value that starts with a protocol.
  //
  // Of course there is no reason to use the `Link` component in the first place in those
  // cases (apps can just use the anchor element directly), but we still want to support
  // it for ease of use, such that apps don't need to themselves switch between different
  // behaviors based on what the `href` looks like. This is especially useful with MDX,
  // since all links can then just use the `Link` component.
  if (href.startsWith('#') || isExternal) {
    eventHandlers = undefined;
  }

  const anchorProps = {
    href: destination,
    ...(isExternal ? { target: '_blank', rel: 'noreferrer' } : {}),
    ...extraProps,

    // We must pass `extraProps` after `eventHandlers`, to allow for overwriting the
    // default event handlers.
    //
    // However, simply deconstructing `extraProps` after deconstructing `eventHandlers`
    // would cause props within `extraProps` to overwrite the props in `eventHandlers`,
    // even if the props in `extraProps` contain the value `undefined`. To avoid this,
    // we are explicitly checking whether the value is falsy before using it.
    onClick: extraProps.onClick || eventHandlers?.onClick,
    onMouseEnter: extraProps.onMouseEnter || eventHandlers?.onMouseEnter,
    onTouchStart: extraProps.onTouchStart || eventHandlers?.onTouchStart,
  } satisfies AnchorHTMLAttributes<HTMLAnchorElement>;

  return <a {...anchorProps}>{children}</a>;
};

wrapClientComponent(Link, 'Link');

export { Link };
