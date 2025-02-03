import type { CookieSerializeOptions } from 'cookie';
import type { verify } from 'hono/jwt';
import type { RONIN } from 'ronin';
import type { Query } from 'ronin/types';
import { getBatchProxy, getSyntaxProxy } from 'ronin/utils';
import { deserializeError } from 'serialize-error';

import { useServerContext } from '../../private/server/hooks';
import type { PageMetadata } from '../../private/server/types';
import { generateHashSync } from '../../private/server/utils/crypto';
import {
  paginateQuery,
  parsePaginationQueryParam,
} from '../../private/server/utils/pagination';
import { BATCH_CONTEXT, SERVER_CONTEXT } from '../../private/server/worker/context';
import type { QueryItemRead } from '../../private/universal/types/util';

export type CookieHookOptions = {
  /**
   * Allows for making cookies accessible to the client, instead of allowing only the
   * server to read and modify them.
   */
  client?: true;
  /**
   * Allows for restricting the cookie to a specific URL path of the app.
   *
   * @default '/'
   */
  path?: string;
};

const useCookie = <T extends string | null>(
  name: string,
): [T | null, (value: T, options?: CookieHookOptions) => void] => {
  const { cookies, collected } = useServerContext();
  const value = cookies[name] as T | null;

  const setValue = (value: T, options?: CookieHookOptions) => {
    const cookieSettings: CookieSerializeOptions = {
      // 365 days.
      maxAge: 31536000,
      httpOnly: !options?.client,
      path: options?.path || '/',
    };

    // To delete cookies, we have to set their expiration time to the past.
    if (value === null) {
      cookieSettings.expires = new Date(Date.now() - 1000000);
      delete cookieSettings.maxAge;
    }
    // As per the types defined for the surrounding function, this condition would never
    // be met. But we'd like to keep it regardless, to catch cases where the types
    // provided to the developer aren't smart enough to avoid `undefined` or similar
    // getting passed.
    else if (typeof value !== 'string') {
      let message = 'Cookies can only be set to a string value, or `null` ';
      message += `for deleting them. Please adjust "${name}".`;
      throw new Error(message);
    }

    if (!collected.cookies) collected.cookies = {};

    collected.cookies[name] = {
      value,
      ...cookieSettings,
    };
  };

  return [value, setValue];
};

export interface IncomingPageMetadata extends Omit<PageMetadata, 'title'> {
  title?: string;
}

/**
 * Allows for populating the `<head>` element of the page with `<meta>` tags that help
 * the browser and crawlers obtain meta information about the currently active page, such
 * as the page title or Open Graph images.
 *
 * @param metadata - A `IncomingPageMetadata` object containing the meta information that
 * should be rendered in the `<head>` element.
 */
const useMetadata = (metadata: IncomingPageMetadata) => {
  const { collected } = useServerContext();
  const { title, ...remainingMetadata } = structuredClone(metadata);

  if (title) {
    // If there's already a title available from a parent layout, make use of that title
    // and combine it with the new one.
    const titleSegments = collected.metadata.title
      ? Array.from(collected.metadata.title)
      : [];
    titleSegments.unshift(title);
    collected.metadata.title = new Set(titleSegments);
  }

  Object.assign(collected.metadata, remainingMetadata);
};

interface DataOptions {
  /** ## 🚧 For internal use only! 🚧 */
  dataSelector?: QueryItemRead['dataSelector'];
}

const queryHandler = (queries: { query: Query; options?: DataOptions }[]): unknown[] => {
  const serverContext = SERVER_CONTEXT.getStore();
  if (!serverContext) throw new Error('Server context not available.');

  const hookHash = generateHashSync(JSON.stringify(queries));

  const executedQueries = serverContext.collected.queries;
  const leafIndex = serverContext.currentLeafIndex;
  if (typeof leafIndex !== 'number') throw new Error('Leaf index not available.');

  const url = new URL(serverContext.url);
  const paginationQueryParam = url.searchParams.get('page');

  const page = parsePaginationQueryParam(paginationQueryParam);

  const formattedQueries: QueryItemRead[] = queries
    .flatMap(({ query, options }, queryIndex): QueryItemRead | QueryItemRead[] => {
      const queryDetails = { ...options, type: 'read' } as QueryItemRead;

      if (
        page &&
        page.leafIndex === leafIndex &&
        page.hookHash === hookHash &&
        page.queryIndex === queryIndex
      ) {
        const { query: newQuery, countQuery } = paginateQuery(
          query,
          page.direction,
          page.cursor,
        );

        return [
          { ...queryDetails, query: JSON.stringify(newQuery) },
          {
            ...queryDetails,
            query: JSON.stringify(countQuery),
            paginationDetails: {
              countForQueryAtIndex: queryIndex,
              direction: page.direction,
            },
          },
        ];
      }

      return { ...queryDetails, query: JSON.stringify(query) };
    })
    .map((currentQuery) => {
      const executedQueryMatch = executedQueries.find(({ query, dataSelector }) => {
        return query === currentQuery.query && dataSelector === currentQuery.dataSelector;
      });

      if (executedQueryMatch) {
        currentQuery.result = executedQueryMatch.result;
        currentQuery.error = executedQueryMatch.error;
      }

      return currentQuery;
    });

  const emptyQueries = formattedQueries.filter(({ result, error }) => {
    return typeof result === 'undefined' && typeof error === 'undefined';
  });

  // If some of the queries are missing results, throw them upwards, which will make
  // BLADE batch the queries, run them, and attach the results to the server context,
  // after which the component will be re-rendered.
  if (emptyQueries.length > 0) throw { __blade_queries: emptyQueries };

  // If all queries have results, return them.
  return formattedQueries
    .filter(({ paginationDetails }) => typeof paginationDetails === 'undefined')
    .map(({ result, error }, queryIndex) => {
      if (typeof error !== 'undefined') throw deserializeError(error);

      if (!Array.isArray(result)) return result;

      const resultArray = result as unknown[] & {
        // Properties that are exposed from the hook.
        previousPage?: string;
        nextPage?: string;
        beforeAmount?: number;
        afterAmount?: number;

        // Properties that are only used internally.
        moreBefore?: string;
        moreAfter?: string;
      };

      const paginationAmountQueryItem = formattedQueries.find((queryDetails) => {
        return queryDetails.paginationDetails?.countForQueryAtIndex === queryIndex;
      });

      if (paginationAmountQueryItem) {
        // Increment the amount by one because the count query will return the amount
        // excluding the cursor record itself.
        const amount = paginationAmountQueryItem.result as number;
        const beforeAmount = amount === 0 ? amount : amount + 1;

        const { direction } = paginationAmountQueryItem.paginationDetails || {};
        const propertyName = direction === 'after' ? 'beforeAmount' : 'afterAmount';

        resultArray[propertyName] = beforeAmount;
      }

      if (resultArray.moreBefore) {
        resultArray.previousPage = `${leafIndex}-${hookHash}-${queryIndex}-b-${resultArray.moreBefore}`;
        delete resultArray.moreBefore;
      }

      if (resultArray.moreAfter) {
        resultArray.nextPage = `${leafIndex}-${hookHash}-${queryIndex}-a-${resultArray.moreAfter}`;
        delete resultArray.moreAfter;
      }

      return result;
    });
};

const use = getSyntaxProxy('get', (query, options?: DataOptions) => {
  return queryHandler([{ query, options }])[0];
}) as RONIN.Getter<DataOptions>;

const useCountOf = getSyntaxProxy('count', (query, options?: DataOptions) => {
  return queryHandler([{ query, options }])[0];
}) as RONIN.Counter<DataOptions>;

const useBatch = <T extends [any, ...any[]]>(
  operations: () => T,
  options?: DataOptions,
) => {
  return getBatchProxy<T>(operations, { asyncContext: BATCH_CONTEXT }, (queries) => {
    const queriesWithIndexes = queries.map((details, index) => {
      // If no query is provided, we should return the details as-is, since they might
      // contain `null`, `undefined`, or a similar placeholder value that the developer
      // wants to retain in the results.
      if (!details) return { query: details, index };

      return { query: details.query, options: details.options, index };
    });

    const queriesClean = queriesWithIndexes.filter(({ query }) => {
      return typeof query === 'object' && query !== null;
    }) as { query: Query; options?: DataOptions; index: number }[];

    const queryResults = queryHandler(
      queriesClean.map(({ query, options: perQueryOptions }) => ({
        query,
        options: perQueryOptions || options,
      })),
    );

    // If one of the hooks provided to `useBatch` returns something that isn't a query
    // (such as `null`), we need to retain that value in the results and only try to run
    // the hook result as a query if it is actually a query.
    return queriesWithIndexes.map(({ query, index }) => {
      const matchingQuery = queriesClean.findIndex((item) => item.index === index);
      if (matchingQuery > -1) return queryResults[matchingQuery];
      return query;
    });
  }) as T;
};

const useJWT = <T>(...args: Parameters<typeof verify>): T => {
  const [token, secret, algo] = args;

  const serverContext = useServerContext();
  const result = serverContext.collected.jwts[token];

  if (result?.decodedPayload) {
    if (result.decodedPayload instanceof Error) throw result.decodedPayload;
    return result.decodedPayload as T;
  }

  throw {
    __blade_jwt: {
      token,
      secret,
      algo,
    },
  };
};

const useMutationResult = <T>(): T => {
  const serverContext = useServerContext();
  const { queries } = serverContext.collected;

  return queries.filter(({ type }) => type === 'write').map(({ result }) => result) as T;
};

export { useCookie, use, useCountOf, useBatch, useMutationResult, useMetadata, useJWT };
