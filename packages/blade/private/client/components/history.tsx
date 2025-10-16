import {
  type FunctionComponent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { RootClientContext } from '@/private/client/context';
import { usePageTransition } from '@/private/client/hooks';
import type { DeferredPromises } from '@/private/client/types/util';
import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import type { UniversalContext } from '@/private/universal/context';
import { usePrivateLocation, useUniversalContext } from '@/private/universal/hooks';
import { usePopulatePathname } from '@/public/universal/hooks';

interface HistoryContentProps {
  children: ReactNode;
}

const HistoryContent: FunctionComponent<HistoryContentProps> = ({ children }) => {
  const universalContext = useUniversalContext();
  const { transitionPage } = usePageTransition();

  const { pathname, search, hash } = usePrivateLocation();
  const populatePathname = usePopulatePathname();
  const populatedPathname = populatePathname(pathname);

  const lastPopulatedPathname = useRef<string | null>(null);
  const lastHash = useRef<string | null>(null);

  // Navigate to different pages whenever the "Previous" and "Next" history actions in
  // the browser are used.
  useEffect(() => {
    const pageChanged = () => {
      const newLocation = window.location;
      const pathname = newLocation.pathname + newLocation.search + newLocation.hash;

      // Don't update the address bar, since the browser already updated it. This also
      // ensures that no additional state entry is pushed into the history.
      transitionPage(pathname, { updateAddressBar: false });
    };

    window.addEventListener('popstate', pageChanged);
    return () => window.removeEventListener('popstate', pageChanged);
  }, [transitionPage]);

  // This is a layout effect because we want the updates within it to apply as soon as
  // possible, before the browser paints. We are using a single effect instead of
  // multiple because the updates within it are mutually exclusive.
  useLayoutEffect(() => {
    // Don't proceed if the page is loaded fresh.
    if (!lastPopulatedPathname.current) return;

    // Don't proceed if the address bar should not be updated.
    if (!universalContext.addressBarInSync) return;

    // Ensure that the address bar is updated.
    history.pushState({}, '', populatedPathname + search + hash);

    // If the hash defined in the URL has changed, scroll the respective element that is
    // available on the page into the view.
    if (hash && lastHash.current !== hash) {
      document.querySelector(hash)?.scrollIntoView();
      return;
    }

    // Ensure that the scroll position is reset whenever the page changes.
    //
    // React has no concept of pages, so changing between pages will cause the scroll
    // position to persist, because React only sees child elements getting swapped out,
    // while the layout (e.g. `<html>` and `<body>`) stays the same.
    //
    // We therefore need to simulate the natural behavior of the browser, which is that
    // you always start at the top of a new page when switching to it, and the scroll
    // position is never resumed.
    //
    // Since BLADE controls `<html>` and `<body>`, it's BLADE's job to handle this,
    // instead of requiring the app to add this code.
    if (populatedPathname && lastPopulatedPathname.current !== populatedPathname) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [populatedPathname + search + hash]);

  // Track the last populated pathname and last hash. This is done in a separate effect
  // (which runs serially after the effect above), to avoid having to define this code in
  // every `return` condition of the effect above. The dependencies defined for the
  // effect right here must match the effects of the effect above.
  useLayoutEffect(() => {
    lastPopulatedPathname.current = populatedPathname;
    lastHash.current = hash;
  }, [populatedPathname + search + hash]);

  return <>{children}</>;
};

interface HistoryProps extends HistoryContentProps {
  children: ReactNode;
  universalContext: UniversalContext;
}

const History = ({ children, universalContext }: HistoryProps) => {
  /**
   * Used for persisting the execution of a query across renders.
   *
   * Whenever a query is executed on the client, it is sent to the edge and executed
   * there, after which the page is re-rendered with the new data. As a result, the
   * original instance of the `useMutation` hook that ran the query might no longer be
   * present (for example if the surrounding component was unmounted). In order for its
   * associated promise to still resolve, we need to persist it across renders.
   */
  const deferredPromises = useRef<DeferredPromises>({});

  /**
   * Used for immediately updating the client-side query string parameters (in the
   * address bar), while the server is still rendering the respective update for the page.
   *
   * This is useful in cases where client-side state is derived from the URL, such as when
   * using a `?search` query parameter to filter a list of items. In those cases, the URL
   * can be updated immediately to avoid having to store additional state on the client,
   * and then the server will process the re-rendering of the page in the meantime.
   *
   * We're intentionally and explicitly only doing this for query string parameters and
   * not for the pathname, because we would otherwise have to require an unpopulated
   * pathname to be passed to `redirect()` calls, which currently accepts populated
   * pathnames as well. Only the server can resolve the unpopulated version (which is
   * essentially the file system path of the page) of a pathname, so we can't do this
   * update on the client alone.
   */
  const [clientQueryParams, setClientQueryParams] = useState<string | null>(null);

  // When a new URL (a new page or a new version of a page) rendered on the server gets
  // displayed, we want to reset any potentially available client-side query parameters,
  // so that subsequent renders will default to the server-side URL again.
  useEffect(() => setClientQueryParams(null), [universalContext.url]);

  // If client-side query params are available, prefer them over the ones available for
  // the server-rendered URL. Before doing so, however, we need to clone the original URL
  // in order to avoid modifying the original.
  const parsedURL = new URL(universalContext.url);
  if (clientQueryParams) parsedURL.search = clientQueryParams;

  return (
    <RootClientContext.Provider
      value={{
        ...universalContext,
        url: parsedURL.href,
        setClientQueryParams,
        deferredPromises,
      }}>
      <HistoryContent>{children}</HistoryContent>
    </RootClientContext.Provider>
  );
};

wrapClientComponent(History, 'History');

export { History };
