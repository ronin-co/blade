import { getFieldFromModel } from '@/src/model';
import type { Model } from '@/src/types/model';
import type { GetInstructions } from '@/src/types/query';
import type { ResultRecord } from '@/src/types/result';
import { getProperty } from '@/src/utils/helpers';

// The separator and NULL placeholder have to be somewhat unique so that they don't
// conflict with any other row values that might be used in the cursor.
export const CURSOR_SEPARATOR = ',';
export const CURSOR_NULL_PLACEHOLDER = 'RONIN_NULL';

/**
 * Generates a pagination cursor for the provided record.
 *
 * @param model - The schema that defined the structure of the record.
 * @param orderedBy - An object specifying the sorting order for the record fields.
 * @param record - The record for which the pagination cursor should be generated.
 *
 * @returns The generated pagination cursor.
 */
export const generatePaginationCursor = (
  model: Model,
  orderedBy: GetInstructions['orderedBy'],
  record: ResultRecord,
): string => {
  const { ascending = [], descending = [] } = orderedBy || {};
  const keys = [...ascending, ...descending];

  // If no fields are specified, we default to sorting by the `createdAt` field.
  if (keys.length === 0) keys.push('ronin.createdAt');

  const cursors = keys.map((fieldSlug) => {
    const property = getProperty(record, fieldSlug as string) as unknown;
    if (property === null || property === undefined) return CURSOR_NULL_PLACEHOLDER;

    const { field } = getFieldFromModel(model, fieldSlug as string, {
      instructionName: 'orderedBy',
    });

    // If the field is of type "date", we convert its value to a timestamp.
    if (field.type === 'date') return new Date(property as string).getTime();

    return property;
  });

  return cursors
    .map((cursor) => encodeURIComponent(String(cursor)))
    .join(CURSOR_SEPARATOR);
};
