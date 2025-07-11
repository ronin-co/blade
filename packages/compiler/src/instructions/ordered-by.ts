import { getFieldFromModel } from '@/src/model';
import type { Model } from '@/src/types/model';
import type { GetInstructions } from '@/src/types/query';
import { getQuerySymbol } from '@/src/utils/helpers';
import { parseFieldExpression } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `orderedBy` query instruction, which allows for
 * ordering the list of records that are returned.
 *
 * @param model - The model associated with the current query.
 * @param instruction - The `orderedBy` instruction provided in the current query.
 *
 * @returns The SQL syntax for the provided `orderedBy` instruction.
 */
export const handleOrderedBy = (
  model: Model,
  instruction: GetInstructions['orderedBy'],
): string => {
  let statement = '';

  const items = [
    ...(instruction!.ascending || []).map((value) => ({ value, order: 'ASC' })),
    ...(instruction!.descending || []).map((value) => ({ value, order: 'DESC' })),
  ];

  for (const item of items) {
    if (statement.length > 0) {
      statement += ', ';
    }

    const symbol = getQuerySymbol(item.value);
    const instructionName =
      item.order === 'ASC' ? 'orderedBy.ascending' : 'orderedBy.descending';

    if (symbol?.type === 'expression') {
      statement += `(${parseFieldExpression(model, instructionName, symbol.value)}) ${item.order}`;
      continue;
    }

    // Check whether the field exists.
    const { field: modelField, fieldSelector } = getFieldFromModel(
      model,
      item.value as string,
      { instructionName },
    );

    const caseInsensitiveStatement =
      modelField.type === 'string' ? ' COLLATE NOCASE' : '';

    statement += `${fieldSelector}${caseInsensitiveStatement} ${item.order}`;
  }

  return `ORDER BY ${statement}`;
};
