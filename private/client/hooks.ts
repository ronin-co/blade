import Queue from 'p-queue';
import {
  type MutableRefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { RootClientContext } from '@/private/client/context';
import type { RevalidationReason } from '@/private/client/types/util';
import fetchPage, { type FetchedPage } from '@/private/client/utils/fetch-page';
import { usePrivateLocation } from '@/private/universal/hooks';
import type { PageFetchingOptions } from '@/private/universal/types/util';
import { IS_DEV } from '@/private/universal/utils/constants';
import logger from '@/private/universal/utils/logs';
import { usePopulatePathname } from '@/public/universal/hooks';

export interface RootTransitionOptions extends PageFetchingOptions {
  /**
   * Update the query string parameters in the address bar of the browser immediately,
   * instead of waiting for the page to be rendered on the server and returned.
   */
  immediatelyUpdateQueryParams?: boolean;
}

const pageTransitionQueue = new Queue({ concurrency: 1 });

export const usePageTransition = () => {
  const cache = useRef(new Map<string, FetchedPage>());

  const clientContext = useContext(RootClientContext);
  if (!clientContext) throw new Error('Missing client context in `usePageTransition`');
  const privateLocationRef = usePrivateLocationRef();

  // We're using a reference to store this number, because we need to keep a single
  // object in memory that is updated with every render, otherwise the information would
  // be outdated in the deeply nested callback functions.
  const lastUpdateTime = useRef<number>(clientContext.lastUpdate);

  // Update the reference as soon as possible (before the browser repaints).
  useLayoutEffect(() => {
    lastUpdateTime.current = clientContext.lastUpdate;
  }, [clientContext.lastUpdate]);

  return (
    path: string,
    type: 'manual' | 'automatic',
    options?: RootTransitionOptions,
  ) => {
    const cacheable = !(options?.queries || options?.immediatelyUpdateQueryParams);
    const privateLocation = privateLocationRef.current;

    if (cacheable) {
      const maxAge = Date.now() - 10000;
      const cacheEntry = cache.current.get(path);

      // If the page was already loaded on the client and it's not older than 10 seconds,
      // we can just render it directly without having to fetch it again.
      //
      // However, this should only happen in production. During development, we are
      // performing HMR, which cannot be slown down by the 10 second threadshold. Whereas
      // in production, caching a page for 10 seconds makes sense.
      if (cacheEntry && cacheEntry.time > maxAge && !IS_DEV) {
        return () => window['BLADE_ROOT']!.render(cacheEntry.body);
      }
    }

    // If desired, already update the query params in the address bar before the server
    // has rendered the new ones. Take a look at the `RootClientContext.Provider`
    // component for more details on this.
    if (options?.immediatelyUpdateQueryParams) {
      const url = new URL(path, privateLocation.origin);

      history.replaceState(history.state, '', url);
      clientContext.setClientQueryParams(url.search);
    }

    // If the page transition was triggered automatically and there's a manual or
    // automatic one in the queue (and therefore about to be run), we want to skip the
    // new one because the purpose of automatic revalidation is to ensure that the page
    // always shows the latest data. If a page transition of any kind will be rendered,
    // that means the page will already show the latest data.
    if (
      type === 'automatic' &&
      (pageTransitionQueue.size > 0 || pageTransitionQueue.pending > 0)
    ) {
      return () => {
        logger.info(
          'Skipping automatic page transition because of other pending page transitions.',
        );
      };
    }

    if (!window.navigator.onLine) {
      if (type === 'automatic') {
        return () => {
          logger.info('Skipping automatic page transition because device is not online.');
        };
      }

      throw new Error('Device is not online to perform manual page transition');
    }

    const ongoingManualAmount = pageTransitionQueue.sizeBy({ priority: 1 });
    const ongoingAutomaticAmount = pageTransitionQueue.sizeBy({ priority: 0 });

    // If there are currently any automatic page transitions in the queue waiting to be
    // run, we want to stop them because a new update is being started. Regardless of
    // whether that new update is manual or automatic, it will cause the page to show the
    // latest data, so we don't want to waste time waiting for the ongoing transition.
    // Only manual updates are guaranteed to always commit, because that's what the user
    // would expect.
    if (ongoingManualAmount === 0 && ongoingAutomaticAmount > 0) {
      pageTransitionQueue.clear();
    }

    const pagePromise = pageTransitionQueue.add(
      async () => {
        const page = await fetchPage(path, options);

        // If the client bundles have changed, don't proceed, since `fetchPage` will
        // retrieve the latest bundles fresh in that case.
        if (!page) {
          // Immediately destroy the page queue, since we now know that the server has
          // changed, so we cannot continue processing any further requests from the old
          // client chunks. We have to do this inside the promise of the current function
          // and not after it resolves, since the queue would otherwise immediately start
          // working on the other queue items.
          //
          // It's critical that this happens inside the promise that is being handled by
          // the queue and not outside the queue, otherwise the queue will already start
          // working on the next item after the current one finishes.
          pageTransitionQueue.pause();
          pageTransitionQueue.clear();

          return null;
        }

        return page;
      },
      { priority: type === 'manual' ? 1 : 0 },
    );

    const pagePromiseChain = pagePromise.then((page) => {
      // Do nothing if no page is available. Logging already happens earlier.
      if (!page) return;

      // As soon as possible, store the page in the cache.
      if (cacheable) cache.current.set(path, page);

      // By the time we're ready to render the new page, a newer page transition might
      // have already been started. If that's the case, we want to skip the current
      // update to prevent the UI from temporarily regressing to an older state.
      if (pageTransitionQueue.size > 0 || pageTransitionQueue.pending > 0) {
        logger.info(
          'Skipping page transition because of a newer pending page transition.',
        );
        return;
      }

      return page;
    });

    return () => {
      pagePromiseChain.then((page) => {
        // If the page is not available, then because the previous `.then()` call decided
        // that it cannot be or should not be rendered.
        if (!page) return;

        // Render the page.
        window['BLADE_ROOT']!.render(page.body);
      });
    };
  };
};

/**
 * Allows for revalidating the current page on the edge, in order to render the most
 * recent version of all the records used on that page.
 *
 * @returns A function that can be used to trigger a revalidation for the currently
 * active page.
 */
export const useRevalidation = <T extends RevalidationReason>() => {
  const transitionPage = usePageTransition();
  const privateLocationRef = usePrivateLocationRef();

  return (reason: T) => {
    const privateLocation = privateLocationRef.current;
    const path = privateLocation.pathname + privateLocation.search + privateLocation.hash;

    logger.info(`Revalidating ${path} (${reason})`);

    transitionPage(path, 'automatic')();
  };
};

/**
 * A React reference acting as a replacement for `window.location`. Due to being a
 * reference, the value is always up-to-date, even inside a callback.
 */
export const usePrivateLocationRef = (): MutableRefObject<URL> => {
  const privateLocation = usePrivateLocation();
  const populatePathname = usePopulatePathname();

  privateLocation.pathname = populatePathname(privateLocation.pathname);
  const ref = useRef(privateLocation);

  useEffect(() => {
    ref.current = privateLocation;
  }, [privateLocation, privateLocation.href]);

  return ref;
};

/**
 * Behaves exactly like `useMemo`, except that the provided factory receives the
 * previously memorized value as an argument, which allows for accumulating state, just
 * like the `.reduce` method on an array would.
 *
 * Furthermore, in addition to returning the computed value (like `useMemo`), the hook
 * also returns a function for updating it from the outside.
 *
 * @param factory - A function for computing a value.
 * @param deps - A list of dependencies. If one of them changes, the factory function
 * will be called and the memorized value will be re-computed.
 *
 * @returns The computed value, and a function for setting it.
 */
export const useReduce = <T>(
  rootFactory: (oldValue: T | undefined) => T,
  deps: unknown[],
): [T, (factory: (oldValue: T) => T) => void] => {
  const value = useRef<T>(rootFactory(undefined));
  const [renderingCount, setRenderingCount] = useState(0);

  // Allow for updating the current value from the outside.
  const setValue = (childFactory: (oldValue: T) => T) => {
    // Update the value that is being rendered.
    value.current = childFactory(value.current);

    // Ask React to re-render the surrounding component. We're intentionally not setting
    // the value itself as state, as that would duplicate it in memory, since we can't
    // use state for the memo below, because that would result in an extra re-render.
    setRenderingCount(renderingCount + 1);
  };

  // Update the current value whenever the dependencies change.
  useMemo(() => {
    value.current = rootFactory(value.current);
  }, deps);

  return [value.current, setValue];
};
