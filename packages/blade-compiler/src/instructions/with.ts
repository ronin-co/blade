import type { Model } from '@/src/types/model';
import type { GetInstructions } from '@/src/types/query';
import { composeConditions } from '@/src/utils/statement';

/**
 * Determines the right SQL assertion syntax for a given value.
 *
 * @param value - The value to be asserted.
 * @param negative - Whether the assertion should be negative.
 *
 * @returns The SQL assertion syntax for the given value.
 */
export const getMatcher = (value: unknown, negative: boolean): string => {
  if (negative) {
    if (value === null) return 'IS NOT';
    return '!=';
  }

  if (value === null) return 'IS';
  return '=';
};

export const WITH_CONDITIONS = {
  being: (value): WithPair => [getMatcher(value, false), value],
  notBeing: (value): WithPair => [getMatcher(value, true), value],

  startingWith: (value): WithPair => ['LIKE', `${value}%`],
  notStartingWith: (value): WithPair => ['NOT LIKE', `${value}%`],

  endingWith: (value): WithPair => ['LIKE', `%${value}`],
  notEndingWith: (value): WithPair => ['NOT LIKE', `%${value}`],

  containing: (value): WithPair => ['LIKE', `%${value}%`],
  notContaining: (value): WithPair => ['NOT LIKE', `%${value}%`],

  greaterThan: (value): WithPair => ['>', value],
  greaterOrEqual: (value): WithPair => ['>=', value],

  lessThan: (value): WithPair => ['<', value],
  lessOrEqual: (value): WithPair => ['<=', value],
} satisfies Record<string, WithMatcher>;

type WithPair = [string, unknown];
type WithMatcher = (value: unknown) => WithPair;
type WithCondition = keyof typeof WITH_CONDITIONS;

type WithValue = string | number | null;
type WithValueOptions = WithValue | Array<WithValue>;
type WithFilters = Record<WithCondition, WithValueOptions>;

export type { WithValue, WithValueOptions, WithFilters, WithCondition };

/**
 * Generates the SQL syntax for the `with` query instruction, which allows for filtering
 * the records that should be addressed.
 *
 * @param models - A list of models.
 * @param model - The model associated with the current query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instruction - The `with` instruction included in a query.
 * @param parentModel - The model of the parent query, if there is one.
 *
 * @returns The SQL syntax for the provided `with` instruction.
 */
export const handleWith = (
  models: Array<Model>,
  model: Model,
  statementParams: Array<unknown> | null,
  instruction: GetInstructions['with'],
  parentModel?: Model,
): string => {
  return composeConditions(
    models,
    model,
    statementParams,
    'with',
    instruction as WithFilters,
    {
      parentModel,
    },
  );
};
