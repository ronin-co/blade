import Queue from 'p-queue';
import {
  type MutableRefObject,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { RootClientContext } from '@/private/client/context';
import { IS_CLIENT_DEV } from '@/private/client/utils/constants';
import { fetchPage } from '@/private/client/utils/page';
import { usePrivateLocation } from '@/private/universal/hooks';
import type { PageFetchingOptions } from '@/private/universal/types/util';
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
  const cache = useRef(new Map<string, { body: ReactNode; time: number }>());

  const clientContext = useContext(RootClientContext);
  if (!clientContext) throw new Error('Missing client context in `usePageTransition`');
  const privateLocationRef = usePrivateLocationRef();

  return (path: string, options?: RootTransitionOptions) => {
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
      if (cacheEntry && cacheEntry.time > maxAge && !IS_CLIENT_DEV) {
        return () => window['BLADE_SESSION']!.root.render(cacheEntry.body);
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

    if (!window.navigator.onLine) {
      throw new Error('Device is not online to perform manual page transition');
    }

    const pagePromise = pageTransitionQueue.add(async () => {
      const page = await fetchPage(path, options);
      const session = window['BLADE_SESSION'];

      // If the client bundles have changed, don't proceed, since `fetchPage` will
      // retrieve the latest bundles fresh in that case.
      //
      // If no browser session is available, new bundles are currently being mounted so
      // we should clear the queue instead of proceeding.
      if (!page || !session) {
        // Immediately destroy the page queue, since we now know that the server has
        // changed, so we cannot continue processing any further requests from the old
        // client chunks. We have to do this inside the promise of the current function
        // and not after it resolves, since the queue would otherwise immediately start
        // working on the other queue items.
        //
        // It's critical that this happens inside the promise that is being handled by
        // the queue and not outside the queue, otherwise the queue will already start
        // working on the next item after the current one finishes.
        //
        // Note that it's absolutely fine for the queue to be destroyed completely,
        // since the new client chunks will mount an entirely new queue.
        pageTransitionQueue.pause();
        pageTransitionQueue.clear();

        return null;
      }

      return page;
    });

    const pagePromiseChain = pagePromise.then((page) => {
      // Do nothing if no page is available. Logging already happens earlier.
      if (!page) return;

      // As soon as possible, store the page in the cache.
      if (cacheable) cache.current.set(path, { body: page, time: Date.now() });

      // By the time we're ready to render the new page, a newer page transition might
      // have already been started. If that's the case, we want to skip the current
      // update to prevent the UI from temporarily regressing to an older state.
      if (pageTransitionQueue.size > 0 || pageTransitionQueue.pending > 0) {
        console.debug(
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
        window['BLADE_SESSION']!.root.render(page);
      });
    };
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
