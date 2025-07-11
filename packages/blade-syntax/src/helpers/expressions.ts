import { QUERY_SYMBOLS } from '@ronin/compiler';

/**
 * Creates a query expression object that can be processed by the compiler.
 *
 * @param expression - The expression string to wrap in a query symbol.
 *
 * @returns An object containing the expression wrapped in a query symbol.
 */
export const expression = <T = Record<typeof QUERY_SYMBOLS.EXPRESSION, string>>(
  expression: string,
): T => ({ [QUERY_SYMBOLS.EXPRESSION]: expression }) as T;

/** Valid operators for string concatenation */
type StringOperator = '||';

/** Valid arithmetic operators for numbers */
type NumberOperator = '+' | '-' | '*' | '/' | '%';

/** Valid comparison operators for numbers and strings */
type ComparisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=';

/**
 * Creates a binary operation expression with type safety for operands.
 *
 * @param left - The left operand.
 * @param operator - The operator to use (string concatenation or arithmetic).
 * @param right - The right operand (must match type of left operand).
 *
 * @returns The formatted binary operation expression.
 */
export const op = <
  T extends string | number | Record<typeof QUERY_SYMBOLS.EXPRESSION, string>,
>(
  left: T,
  operator: NumberOperator | ComparisonOperator | StringOperator,
  right: T,
): T => {
  // Unwrap the left and right operands if they are expression objects
  let leftValue = left;
  if (typeof left === 'object' && QUERY_SYMBOLS.EXPRESSION in left) {
    leftValue = left[QUERY_SYMBOLS.EXPRESSION] as T;
  }

  // Unwrap the right operand if it is an expression object
  let rightValue = right;
  if (typeof right === 'object' && QUERY_SYMBOLS.EXPRESSION in right) {
    rightValue = right[QUERY_SYMBOLS.EXPRESSION] as T;
  }

  // Wrap the left and right operands in single quotes if they are strings
  let wrappedLeft = leftValue;
  if (
    typeof leftValue === 'string' &&
    !(
      typeof left === 'object' &&
      (QUERY_SYMBOLS.EXPRESSION in left || QUERY_SYMBOLS.FIELD in left)
    )
  ) {
    wrappedLeft = `'${leftValue}'` as T;
  }

  // Wrap the right operand in single quotes if it is a string
  let wrappedRight = rightValue;
  if (
    typeof rightValue === 'string' &&
    !(
      typeof right === 'object' &&
      (QUERY_SYMBOLS.EXPRESSION in right || QUERY_SYMBOLS.FIELD in right)
    )
  ) {
    wrappedRight = `'${rightValue}'` as T;
  }

  return expression<T>(`(${wrappedLeft} ${operator} ${wrappedRight})`);
};
