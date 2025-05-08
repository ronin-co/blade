import * as Sentry from '@sentry/react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ErrorBoundary as ErrorBoundaryFallback } from '@/private/client/components/error-boundary';
import { RootClientContext } from '@/private/client/context';
import { usePageTransition, useRevalidation } from '@/private/client/hooks';
import type { DeferredPromises, RevalidationReason } from '@/private/client/types/util';
import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import type { UniversalContext } from '@/private/universal/context';
import { usePrivateLocation, useUniversalContext } from '@/private/universal/hooks';
import { SENTRY_ENVIRONMENT } from '@/private/universal/utils/constants';
import { usePopulatePathname } from '@/public/universal/hooks';

interface HistoryContentProps {
  children: ReactNode;
}

// If no DSN is available, Sentry automatically avoids initialization.
//
// In addition, however, we must prevent the initialization if the client component is
// rendered on the server. That's because the server uses a separate Sentry instance that
// sits outside React's component tree, in order to guarantee that all errors are caught.
if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: import.meta.env.BLADE_PUBLIC_SENTRY_DSN,
    release: import.meta.env.BLADE_PUBLIC_GIT_COMMIT,
    environment: SENTRY_ENVIRONMENT,
    integrations: [
      Sentry.browserProfilingIntegration(),
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],

    // Capture 100% of all Traces.
    tracesSampleRate: 1.0,
    // Propagate Traces to the edge.
    //
    // We're allowing `localhost` here, but Sentry won't even get activated unless the
    // `BLADE_PUBLIC_SENTRY_DSN` environment variable is set, which should not be set
    // locally. This is just to allow for testing the integration.
    tracePropagationTargets: ['localhost', /^https:\/\/ronin\.co/],

    // Capture Replays for 10% of all sessions, plus for 100% of sessions during which an
    // error occurred.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Capture 100% of all Performance Profiles.
    profilesSampleRate: 1.0,
  });
}

const HistoryContent = ({ children }: HistoryContentProps) => {
  const universalContext = useUniversalContext();
  const transitionPage = usePageTransition();

  const revalidate = useRevalidation<RevalidationReason>();
  const revalidationInterval = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { pathname, search, hash } = usePrivateLocation();
  const populatePathname = usePopulatePathname();
  const populatedPathname = populatePathname(pathname);

  // Navigate to different pages whenever the "Previous" and "Next" history actions in
  // the browser are used.
  useEffect(() => {
    const pageChanged = () => {
      const newLocation = window.location;
      const pathname = newLocation.pathname + newLocation.search + newLocation.hash;
      transitionPage(pathname, 'manual')();
    };

    window.addEventListener('popstate', pageChanged);
    return () => window.removeEventListener('popstate', pageChanged);
  }, [transitionPage]);

  // Update the records on the current page if the window gains focus.
  useEffect(() => {
    const focused = () => revalidate('window focused');

    window.addEventListener('focus', focused);
    return () => window.removeEventListener('focus', focused);
  }, [revalidate]);

  // Update the records on the current page when the device goes back online.
  useEffect(() => {
    const wentOnline = () => revalidate('went online');

    window.addEventListener('online', wentOnline);
    return () => window.removeEventListener('online', wentOnline);
  }, [revalidate]);

  // Revalidate the current page whenever the code of the server bundle gets updated
  // during development. This happens whenever client or server components are changed.
  useEffect(() => {
    if (import.meta.env.BLADE_ENV !== 'development') return;

    // Here we default to the origin available in the browser, because BLADE might
    // locally sit behind a proxy that terminates TLS, in which case the origin protocol
    // would be `http` if we make use of the location provided by `usePrivateLocation`,
    // since that comes from the server.
    const url = new URL('/_blade/reload', window.location.origin);

    // This also replaces `https` with `wss` automatically.
    url.protocol = url.protocol.replace('http', 'ws');

    const refresh = () => revalidate('files updated');
    let ws = new WebSocket(url.toString());

    // If the connection was closed unexpectedly, try to reconnect.
    const reconnect = () => {
      removeListeners();
      ws = new WebSocket(url.toString());
    };

    ws.addEventListener('close', reconnect);
    ws.addEventListener('message', refresh);

    const removeListeners = () => {
      ws.removeEventListener('close', reconnect);
      ws.removeEventListener('message', refresh);
    };

    return () => {
      removeListeners();
      ws.close();
    };
  }, [revalidate]);

  // Update the records on the current page while looking at the window. The update
  // should be performed every 5 seconds, but to ensure that there are never two updates
  // happening at once, we should only begin a new update once the last one has resulted
  // in a successful render.
  useEffect(() => {
    if (revalidationInterval.current) return;

    revalidationInterval.current = setTimeout(() => {
      revalidate('interval');
      revalidationInterval.current = null;
    }, 5000);
  }, [revalidate, universalContext.lastUpdate]);

  // Ensure that the address bar is updated whenever the page changes, but only if this
  // is desired by the trigger of the page change.
  useLayoutEffect(() => {
    if (universalContext.addressBarInSync)
      history.pushState({}, '', populatedPathname + search + hash);
  }, [populatedPathname + search + hash]);

  // Ensure that the scroll position is reset whenever the page changes.
  //
  // React has no concept of pages, so changing between pages will cause the scroll
  // position to persist, because React only sees child elements getting swapped out,
  // while the layout (e.g. `<html>` and `<body>`) stays the same.
  //
  // We therefore need to simulate the natural behavior of the browser, which is that you
  // always start at the top of a new page when switching to it, and the scroll position
  // is never resumed.
  //
  // Since BLADE controls `<html>` and `<body>`, it's BLADE's job to handle this,
  // instead of requiring the app to add this code.
  useLayoutEffect(() => {
    if (document.documentElement.scrollTop === 0 && document.body.scrollTop === 0) return;

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [populatedPathname]);

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
    <Sentry.ErrorBoundary
      fallback={ErrorBoundaryFallback}
      showDialog={true}
      dialogOptions={{
        title: 'An unexpected error occurred.',
        lang: 'en',
      }}>
      <RootClientContext.Provider
        value={{
          ...universalContext,
          url: parsedURL.href,
          setClientQueryParams,
          deferredPromises,
        }}>
        <HistoryContent>{children}</HistoryContent>
      </RootClientContext.Provider>
    </Sentry.ErrorBoundary>
  );
};

wrapClientComponent(History, 'History');

export { History };
