import type { GetQueryInstructions, Query } from '@ronin/compiler';

import type { PaginationInstruction } from '../../universal/types/util';

/**
 * Allows for parsing the `?page` query string parameter used for pagination.
 *
 * @param queryParam - The value of the `?page` query string parameter.
 *
 * @returns The parsed information contained within the `?page` parameter.
 */
export const parsePaginationQueryParam = (
  queryParam: string | null,
): PaginationInstruction | null => {
  // If the query param is empty, return `null`.
  if (!queryParam) return null;

  const [leafIndex, hookHash, queryIndex, direction, cursor] = queryParam.split('-');

  // If any of the required parts of the query param are missing, return `null`.
  // This can happen if people delete parts of the query param in the URL.
  if (!leafIndex || !hookHash || !queryIndex || !direction || !cursor) return null;

  const parsedLeafIndex = Number.parseInt(leafIndex);
  const parsedHookHash = Number.parseInt(hookHash);
  const parsedQueryIndex = Number.parseInt(queryIndex);

  // If any of the required parts don't have the right type, return `null`.
  // This can happen if people change parts of the query param in the URL.
  if (
    Number.isNaN(parsedLeafIndex) ||
    Number.isNaN(parsedHookHash) ||
    Number.isNaN(parsedQueryIndex)
  )
    return null;

  return {
    leafIndex: parsedLeafIndex,
    hookHash: parsedHookHash,
    queryIndex: parsedQueryIndex,
    direction: direction === 'b' ? 'before' : 'after',
    cursor,
  };
};

/**
 * Safely attaches the `before` or `after` instruction to a query and creates another
 * query that determines how many records are available before or after the selected page
 * of records.
 *
 * @param query - The `Query` to which the instruction should be attached.
 * @param direction - The direction into which the pagination should go.
 * @param cursor - The value of the `before` or `after` instruction.
 *
 * @returns The updated main `Query` and the additional `Query` for counting.
 */
export const paginateQuery = (
  query: Query,
  direction: PaginationInstruction['direction'],
  cursor: PaginationInstruction['cursor'],
): { query: Query; countQuery: Query } => {
  const queryValue = Object.values(query)[0] as { [key: string]: GetQueryInstructions };

  const querySchema = Object.keys(queryValue)[0] as string;

  if (queryValue[querySchema] === null) {
    queryValue[querySchema] = {};
  }

  const queryInstructions = queryValue[querySchema];
  queryInstructions[direction] = cursor;

  const countQuery = {
    count: {
      [querySchema]: {
        with: queryInstructions.with,
        orderedBy: queryInstructions.orderedBy,
        ...(direction === 'before' ? { after: cursor } : { before: cursor }),
      },
    },
  } as Query;

  return {
    query,
    countQuery,
  };
};
