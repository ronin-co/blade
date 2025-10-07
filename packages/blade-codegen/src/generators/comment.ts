import { READABLE_DML_QUERY_TYPES } from '@/src/constants/schema';

import type { QueryType } from '@/src/types/query';
import type { PopulatedModel } from 'blade-compiler';

interface GenerateQueryTypeCommentResult {
  singular: string;
  plural: string;
}

/**
 * Generate a text comment for a provided model & a given query type.
 *
 * @param modelName - The name of the model to generate a comment for.
 * @param queryType - The query type to generate a comment for.
 *
 * @returns An object containing both the singular and plural comment strings.
 */
export const generateQueryTypeComment = (
  model: PopulatedModel,
  queryType: QueryType,
): GenerateQueryTypeCommentResult => ({
  singular: `* ${READABLE_DML_QUERY_TYPES[queryType]} a single ${model.name ?? model.slug} record `,
  plural: `* ${READABLE_DML_QUERY_TYPES[queryType]} multiple ${model.name ?? model.slug} records `,
});
