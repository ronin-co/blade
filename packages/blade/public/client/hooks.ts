import { isStorableObject, processStorableObjects } from 'blade-client/utils';
import type { Query } from 'blade-compiler';
import {
  type AddQuery,
  QUERY_SYMBOLS,
  type RemoveQuery,
  type SetQuery,
} from 'blade-compiler';
import {
  type DeepCallable,
  type PromiseTuple,
  type SyntaxItem,
  getBatchProxy,
  getSyntaxProxy,
} from 'blade-syntax/queries';
import {
  type MouseEvent,
  type MouseEventHandler,
  type TouchEventHandler,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { deserializeError } from 'serialize-error';

import { RootClientContext } from '@/private/client/context';
import {
  usePageTransition,
  usePrivateLocationRef,
  useReduce,
} from '@/private/client/hooks';
import type { PageFetchingOptions } from '@/private/universal/types/util';
import { generateUniqueId } from '@/private/universal/utils/crypto';
import { useLocation, usePopulatePathname, useRedirect } from '@/public/universal/hooks';

interface MutationOptions {
  /** Display a different page once the queries have run. */
  redirect?: string;
  /** A custom RONIN database in your space for which the queries should be executed. */
  database?: string;
}

export const useMutation = (): {
  set: DeepCallable<SetQuery>;
  add: DeepCallable<AddQuery>;
  remove: DeepCallable<RemoveQuery>;

  batch: <T extends [Promise<any>, ...Promise<any>[]]>(
    operations: () => T,
    queryOptions?: Record<string, unknown>,
  ) => Promise<PromiseTuple<T>>;
} => {
  const clientContext = useContext(RootClientContext);
  if (!clientContext) throw new Error('Missing client context in `useMutation`');

  const { deferredPromises, collected } = clientContext;

  const privateLocationRef = usePrivateLocationRef();
  const { transitionPage } = usePageTransition();
  const populatePathname = usePopulatePathname();

  // Whenever a write query is performed on the client-side, a promise is created and
  // deferred. This promise is then resolved during a future render of the page once the
  // server has executed the query and provided the results as part of the client context
  // for the page.
  for (const [promiseID, promise] of Object.entries(deferredPromises.current)) {
    let rejection: unknown;

    const results = collected.queries
      .filter(({ hookHash, result, error }) => {
        if (hookHash !== promiseID) return false;
        if (typeof error !== 'undefined') rejection = error;
        return typeof result !== 'undefined';
      })
      .map(({ result }) => result);

    if (rejection) {
      promise.reject(deserializeError(rejection));
    } else if (results.length > 0) {
      promise.resolve(results);
    }
  }

  const queryHandler = async (
    queries: Query[],
    options?: MutationOptions,
  ): Promise<unknown[]> => {
    const privateLocation = privateLocationRef.current;
    const currentPathnameWithQuery =
      privateLocation.pathname + privateLocation.search + privateLocation.hash;
    const destination = options?.redirect
      ? populatePathname(options.redirect)
      : currentPathnameWithQuery;

    const hookHash = generateUniqueId();

    const files = new Map<string, Blob>();

    // Extract binary objects (such as `File`s or `Blob`s) that might be included in the
    // queries so that we can later stream them to the server as separate entities.
    const updatedQueries: Array<Query> = await processStorableObjects(
      queries,
      (objects) => {
        return objects.map(({ value: file }) => {
          const id = generateUniqueId();
          files.set(id, file);

          return {
            name: file.name,
            key: id,
            src: file.name,
            meta: {
              size: file.size,
              type: file.type,
            },
            placeholder: null,
          };
        });
      },
    );

    transitionPage(destination, {
      queries: queries.map((_, index) => ({
        query: JSON.stringify(updatedQueries[index]),
        type: 'write',
        database: options?.database,
        hookHash,
      })),
      errorFallback: currentPathnameWithQuery,
      files,
    });

    return new Promise((resolve, reject) => {
      const clear = () => {
        delete deferredPromises.current[hookHash];
      };

      deferredPromises.current[hookHash] = {
        resolve: (result) => {
          resolve(result);
          clear();
        },
        reject: (error: Error) => {
          reject(error);
          clear();
        },
      };
    });
  };

  const callback = async (defaultQuery: Query, options?: MutationOptions) => {
    const query = defaultQuery as Record<typeof QUERY_SYMBOLS.QUERY, Query>;
    return (await queryHandler([query[QUERY_SYMBOLS.QUERY]], options))[0];
  };

  // Ensure that storable objects are retained as-is instead of being serialized.
  const replacer = (value: unknown) => (isStorableObject(value) ? value : undefined);

  return {
    add: getSyntaxProxy<AddQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.add`,
      callback,
      replacer,
    }),
    set: getSyntaxProxy<SetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.set`,
      callback,
      replacer,
    }),
    remove: getSyntaxProxy<RemoveQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.remove`,
      callback,
      replacer,
    }),

    batch: <T extends [Promise<any>, ...Promise<any>[]]>(
      operations: () => T,
      options?: MutationOptions,
    ) => {
      const batchOperations = operations as unknown as () => Array<SyntaxItem<Query>>;
      const queries = getBatchProxy(batchOperations).map(({ structure }) => structure);

      return queryHandler(queries, options) as Promise<PromiseTuple<T>>;
    },
  };
};

// We're exposing this as a dedicated hook because there are often cases where it's not
// possible to use our native `<Link>` component, but the event handlers are still needed.
// For example, if a drag-and-drop system is used, it might want to overwrite the click
// handler and then choose to fire the one provided by Blade whenever it deems it to be a
// good idea, instead of the browser immediately firing it after `onMouseUp`.
export const useLinkEvents = (
  destination?: string,
): {
  onClick: MouseEventHandler | undefined;

  onMouseEnter: MouseEventHandler | undefined;
  onTouchStart: TouchEventHandler | undefined;
} => {
  const { primePageCache, transitionPage } = usePageTransition();
  const populatePathname = usePopulatePathname();
  const activeTransition = useRef<() => void>();

  // The `destination` parameter is optional because components often have optional
  // `href` props, and since React doesn't allow hooks to be invoked conditionally, we
  // instead have to account for it ourselves. It's important that `undefined` and not
  // `null` is returned in this case, because the `onClick` prop that React offers for
  // elements does not allow `null`.
  if (!destination) {
    return {
      onClick: undefined,

      onMouseEnter: undefined,
      onTouchStart: undefined,
    };
  }

  const populatedPathname = populatePathname(destination);

  const primePage = () => {
    // We don't want to rely on `event.target` for retrieving the destination path, as
    // the event target might not be a link in the case that there are many nested
    // children present.
    primePageCache(populatedPathname);
  };

  return {
    onMouseEnter: () => primePage(),
    onTouchStart: () => primePage(),

    onClick: (event: MouseEvent) => {
      // With this, we're ensuring that the entire link acts like the default navigation
      // behavior that normally applies when clicking a link. Like that, if a different
      // event handler prevents the default action, we don't want to trigger the link.
      if (event.defaultPrevented) return;

      // If someone wants to open the link in a new tab, we can just stop the execution of
      // our own code and therefore allow for the default behavior of the browser to
      // execute. More specifically, opening a link in a new tab means the browser has to
      // load the page fresh anyways, so there's no need for us to handle the navigation.
      if (event.metaKey) return;

      // Prevent the default browser behavior of links.
      event.preventDefault();

      // In the majority of cases, `onClick` will fire after `onMouseUp` or
      // `onTouchStart` and thereby prime the page cache. However, there are cases in
      // which they don't fire before `onClick`, such as when the element moves under a
      // stationary pointer, for example via scrolling, CSS transforms, or DOM
      // repositioning. In those cases, we have to make sure the page is still primed
      // before we can render it.
      if (!activeTransition.current) primePage();

      // Render the primed page.
      transitionPage(populatedPathname, { acceptCache: true });
    },
  };
};

/**
 * Hook for paginating a list of records intelligently.
 *
 * @param nextPage - The pagination identifier provided for a list of records by `use`.
 * In the case of `const accounts = use.accounts();`, for example, `accounts.nextPage`
 * should be passed.
 * @param options - A list of options for customizing the pagination behavior.
 * @param options.updateAddressBar - By default, a `?page` parameter will be added to the
 * URL, which allows for sharing the current pagination status of the page with other
 * people. Setting this argument to `false` will avoid that.
 *
 * @returns A function that can be invoked to load the next page.
 */
export const usePagination = (
  nextPage: string | null,
  options?: Partial<Pick<PageFetchingOptions, 'updateAddressBar'>>,
): { paginate: () => void; resetPagination: () => void } => {
  const { transitionPage } = usePageTransition();
  const privateLocationRef = usePrivateLocationRef();

  // These two must be references and not memos in order to avoid a stale closure of the
  // returned functions at the bottom.
  const loadingMore = useRef<boolean>(false);

  useEffect(() => {
    if (!loadingMore.current) return;
    loadingMore.current = false;
  }, [nextPage]);

  const resetPagination = () => {
    const privateLocation = privateLocationRef.current;

    if (!privateLocation.searchParams.has('page')) {
      console.debug(`Cannot reset pagination because it isn't active.`);
      return;
    }

    console.debug('Pagination was reset');

    // Remove the `?page` query parameter from the URL if it is present.
    const newSearchParams = new URLSearchParams(privateLocation.searchParams);
    newSearchParams.delete('page');
    const params = newSearchParams.toString();

    transitionPage(privateLocation.pathname + (params ? `?${params}` : ''));
  };

  if (!nextPage) {
    return {
      paginate: () => {
        console.debug(
          'Pagination did not occur because no further records are available.',
        );
      },
      resetPagination,
    };
  }

  const paginate = () => {
    const privateLocation = privateLocationRef.current;

    if (loadingMore.current) {
      console.debug('Pagination did not occur again because it is already ongoing.');
      return;
    }

    // To make it possible to send a link to a specific page, even if infinite scrolling
    // is used, we want to add a `?page` query string parameter to the URL. However, we
    // only want to assign it once the addressed page has already been displayed in the
    // UI, so we're storing it inside a reference that persists across renders. Then the
    // address bar is updated in the effect above.
    const newSearchParams = new URLSearchParams(privateLocation.searchParams);
    newSearchParams.set('page', nextPage);
    const newPath = `${privateLocation.pathname}?${newSearchParams.toString()}`;

    loadingMore.current = true;

    transitionPage(newPath, { updateAddressBar: options?.updateAddressBar });
  };

  return { paginate, resetPagination };
};

/**
 * Concatenates arrays based on pagination. Whenever the current paginated page changes,
 * the provided items will be concatenated with the previously provided list of items.
 *
 * @param items - An array of items (of any type) that should be accumulated. For example,
 * this could be a list of React children.
 * @param options.previousPage - The `previousPage` property of the record list that
 * should be paginated.
 * @param options.allowUpdates - Controls whether changes to the provided items should be
 * allowed, or if they should instead just be ignored.
 *
 * @returns The concatenated array of items, and a function for updating it.
 */
export const usePaginationBuffer = <T>(
  items: T[],
  options: { previousPage?: string; allowUpdates?: boolean },
): [T[], (factory: (prevState: T[]) => T[]) => void] => {
  const { allowUpdates = true, previousPage: page } = options;

  const [renderedChildren, setRenderedChildren] = useReduce<{
    buffered: boolean;
    items: T[];
    page: string | undefined;
  }>(
    (existing) => {
      const storedPreviousPage = existing?.page;

      // If pagination becomes active or the pagination page changes, we'd like to
      // accumulate the incoming items, which concatenates the pages.
      if (
        (!storedPreviousPage && page) ||
        (storedPreviousPage && page && storedPreviousPage !== page)
      ) {
        return {
          buffered: true,
          items: [...(existing?.items || []), ...items],
          page,
        };
      }

      // If updates (such as from pagination) are not allowed and the items are already
      // buffered, we can't update them.
      if (!allowUpdates && existing?.buffered) return existing;

      // If new items are incoming, pagination is active, but the page is not changing,
      // that means revalidation is happening. In that case we can only update the
      // existing items if we didn't previously start accumulating them.
      if (storedPreviousPage && page && storedPreviousPage === page) {
        const buffered = existing?.buffered || false;

        return {
          buffered,
          items: buffered ? existing?.items || [] : items,
          page,
        };
      }

      // If pagination isn't active, render the latest items.
      return { buffered: false, items, page };
    },
    [items],
  );

  const setValue = (factory: (prevState: T[]) => T[]) => {
    setRenderedChildren((prevState) => ({
      ...prevState,
      items: factory(prevState.items),
    }));
  };

  return [renderedChildren.items, setValue];
};

/**
 * A hook for search / query parameter state management.
 *
 * @param key - The key of the query parameter to manage.
 * @param options - Options for the query parameter.
 *
 * @returns A tuple containing the current value of the query parameter and a function to set it.
 *
 * @example
 * ```tsx
 * import { useQueryState } from 'blade/client/hooks';
 *
 * export default () => {
 *  const [hello, setHello] = useQueryState('hello');
 *
 *  return (
 *    <>
 *      <input
 *        onChange={(e) => setHello(e.target.value)}
 *        value={hello}
 *      />
 *      <p>Hello, {hello || 'world'}!</p>
 *    </>
 *  )
 * }
 * ```
 */
export const useQueryState = <T = string>(
  key: string,
  options?: {
    defaultValue?: T;
    parse?: (ctx: { defaultValue: T | null; value: string }) => T | null;
  },
): [T, (value: T | null) => void] => {
  const { defaultValue = null, parse } = options ?? {};

  const location = useLocation();
  const redirect = useRedirect();

  const queryState = useMemo(() => {
    const rawParam = location.searchParams.get(key);
    if (rawParam === null) return defaultValue;

    if (parse)
      return parse({
        defaultValue: defaultValue,
        value: rawParam,
      });

    return rawParam;
  }, [location.searchParams]);

  const setQueryState = useCallback(
    (value: T | null): void => {
      if (value === null) {
        location.searchParams.delete(key);
        redirect(location.href, { immediatelyUpdateQueryParams: true });
        return;
      }

      location.searchParams.set(key, String(value));
      redirect(location.href, { immediatelyUpdateQueryParams: true });
    },
    [queryState, location.searchParams, redirect],
  );

  return [queryState as T, setQueryState];
};
