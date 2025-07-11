import type { Instructions } from '@/src/types/query';

/**
 * Generates the SQL syntax for the `limitedTo` query instruction, which allows for
 * limiting the amount of records that are returned.
 *
 * @param single - Whether a single or multiple records are being queried.
 * @param instruction - The `limitedTo` instruction provided in the current query.
 *
 * @returns The SQL syntax for the provided `limitedTo` instruction.
 */
export const handleLimitedTo = (
  single: boolean,
  instruction: Instructions['limitedTo'],
): string => {
  let amount: number | undefined;

  // The amount of records that should be returned at most, in the case that multiple
  // are being requested.
  //
  // We're including one extra record in addition to the page size for multiple records,
  // because that allows us to know whether there are more records beyond the page size
  // or not. That way, we can let the client know whether or not it can paginate.
  if (instruction) amount = instruction + 1;

  // If a single record is being requested, limit the amount of returned records to `1`.
  // If multiple records are being requested, limit the amount of returned records to the
  // page size defined above.
  if (single) amount = 1;

  // The final SQL syntax needed for limiting the amount of rows that are returned.
  return `LIMIT ${amount} `;
};
