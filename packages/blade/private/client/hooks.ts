import { omit } from 'radash';
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
   * Whether to read the page from the local cache. This will also cause the page to get
   * retrieved again after it was rendered, to make sure it is up-to-date and a
   * subscription for updates is established.
   */
  acceptCache?: boolean;
  /**
   * Update the query string parameters in the address bar of the browser immediately,
   * instead of waiting for the page to be rendered on the server and returned.
   */
  immediatelyUpdateQueryParams?: boolean;
}

export const usePageTransition = () => {
  const cache = useRef(new Map<string, { body: Promise<ReactNode>; time: number }>());

  const clientContext = useContext(RootClientContext);
  if (!clientContext) throw new Error('Missing client context in `usePageTransition`');
  const privateLocationRef = usePrivateLocationRef();

  const primePageCache = (path: string) => {
    const promise = fetchPage(path, false);

    // The time should be set to when we started fetching, since that's the time at which
    // the data within the page was last updated.
    cache.current.set(path, { body: promise, time: Date.now() });
  };

  const transitionPage = (path: string, options?: RootTransitionOptions) => {
    const privateLocation = privateLocationRef.current;

    if (options?.acceptCache) {
      const maxAge = Date.now() - 10000;
      const cacheEntry = cache.current.get(path);

      // If the page was already loaded on the client and it's not older than 10 seconds,
      // we can render it immediately from cache, and subscribe later.
      //
      // However, this should only happen in production. During development, we are
      // performing HMR, which cannot be slown down by the 10 second threadshold. Whereas
      // in production, caching a page for 10 seconds makes sense.
      if (cacheEntry && cacheEntry.time > maxAge && !IS_CLIENT_DEV) {
        cacheEntry.body.then((page) => window['BLADE_SESSION']!.root.render(page));
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

    // Only retain options allowed by `PageFetchingOptions`.
    const pageOptions = omit(options || {}, [
      'acceptCache',
      'immediatelyUpdateQueryParams',
    ]);

    fetchPage(path, true, pageOptions);
  };

  return { primePageCache, transitionPage };
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
