import { BetterAuthError } from 'better-auth';

import type { Where } from 'better-auth';
import type { createSyntaxFactory } from 'blade-client';
import type { Model as BaseModel, ResultRecordBase } from 'blade-compiler';
import type { CombinedInstructions } from 'blade-compiler';

type Model = Omit<BaseModel, 'pluralSlug'> & Required<Pick<BaseModel, 'pluralSlug'>>;

const HTTP_PATTERN = /^https?:\/\//;

/**
 * Converts a Better Auth SQL where clause to a RONIN query assertion.
 *
 * @param where - A list of where clauses to be converted to RONIN assertions.
 *
 * @returns A single object or an array of objects representing the RONIN assertions.
 */
export const convertWhereClause = <T extends Array<Where>>(
  where: T,
): Record<string, unknown> | Array<Record<string, unknown>> => {
  if (!where || where.length === 0) return {};

  if (where.length === 1) {
    const w = where[0];
    if (!w) return {};

    if (w.operator === 'eq' || !w.operator)
      return {
        [w.field]: w.value,
      };

    return {
      [w.field]: operatorToAssertion(w.operator, w.value),
    };
  }

  const and = where.filter((w) => w.connector === 'AND' || !w.connector);
  const andClause = and.map((w) => {
    if (w.operator === 'eq' || !w.operator)
      return {
        [w.field]: w.value,
      };

    return {
      [w.field]: operatorToAssertion(w.operator, w.value),
    };
  });
  if (andClause.length > 0) return Object.assign({}, ...andClause);

  const or = where.filter((w) => w.connector === 'OR');

  return or.map((w) => {
    if (w.operator === 'eq' || !w.operator)
      return {
        [w.field]: w.value,
      };

    return {
      [w.field]: operatorToAssertion(w.operator, w.value),
    };
  });
};

/**
 * Gets a model definition from RONIN & check if it has a plural slug.
 *
 * @param factory - The RONIN syntax factory to use for the query.
 * @param slug - The slug of the model to retrieve.
 *
 * @returns The model definition.
 *
 * @todo Find a synchronous way to get the model plural slug rather than having to request the model definition from RONIN directly.
 */
export const getModel = async (
  factory: ReturnType<typeof createSyntaxFactory>,
  slug: string,
): Promise<Model> => {
  // @ts-expect-error `list` queries are not currently natively typed.
  const model = (await factory.list.model(slug)) as BaseModel | null;
  if (!model)
    throw new BetterAuthError(
      'Failed to resolve model',
      `No model found for slug \`${slug}\``,
    );

  if (!model.pluralSlug)
    throw new BetterAuthError(
      'Invalid RONIN model',
      `The \`pluralSlug\` for the \`${slug}\` is missing or broken.`,
    );

  return model as Model;
};

/**
 * Transforms a provided inout data or query & converts it to RONIN query instructions.
 *
 * @param data - The data to be transformed.
 * @param model - The model to be used for the transformation.
 *
 * @returns The transformed data as a RONIN query instruction.
 */
export const transformInput = async <
  T extends Record<string, unknown> | Array<Record<string, unknown>>,
>(
  data: T,
  model: string,
): Promise<T> => {
  if (Array.isArray(data)) {
    const results = await Promise.all(data.map((d) => transformInput(d, model)));
    return results as unknown as T;
  }

  const { createdAt, updatedAt, ...values } = data;

  const properties = new Map<string, unknown>();

  if (createdAt || updatedAt)
    properties.set('ronin', {
      createdAt: createdAt ?? null,
      updatedAt: updatedAt ?? null,
    });

  for (const [key, value] of Object.entries(values)) {
    // When signing in / up with OAuth we can be provided a URL string as a link to an
    // image for a user. As such, we need to pull this image so we can provide it as a
    // `Blob` to RONIN when creating the user.
    if (key === 'image' && model === 'user' && typeof value === 'string') {
      properties.set(key, null);

      if (HTTP_PATTERN.test(value)) {
        const response = await fetch(value);
        if (!response.ok) continue;
        properties.set(key, await response.blob());
      }

      continue;
    }

    properties.set(key, value);
  }

  return Object.fromEntries(properties) as T;
};

/**
 * Transforms a provided Better Auth `sortBy` object to a RONIN `orderedBy` instruction.
 *
 * @param [sortBy] - The `sortBy` object to be transformed.
 *
 * @returns The transformed `orderedBy` instruction or `undefined` if no `sortBy` is provided.
 */
export const transformOrderedBy = (sortBy?: {
  field: string;
  direction: 'asc' | 'desc';
}): CombinedInstructions['orderedBy'] | undefined => {
  if (!sortBy) return undefined;

  const key = sortBy.direction === 'asc' ? 'ascending' : 'descending';

  const results = new Array<string>();
  switch (sortBy.field) {
    case 'createdAt': {
      results.push('ronin.createdAt');
      break;
    }
    case 'updatedAt': {
      results.push('ronin.updatedAt');
      break;
    }
    default:
      results.push(sortBy.field);
      break;
  }

  return {
    [key]: results,
  };
};

/**
 * Transforms a provided RONIN result record to a Better Auth object structure.
 *
 * @param data - The RONIN result record to be transformed.
 * @param model - The model to be used for the transformation.
 *
 * @returns The transformed object or `null` if no data is provided.
 */
export const transformOutput = (
  data: ResultRecordBase<Date> | null,
): Record<string, unknown> | null => {
  if (!data || data === null) return null;

  const { id, ronin, ...values } = data;

  const properties = new Map<string, unknown>([
    ['id', id],
    ['createdAt', ronin?.createdAt],
    ['updatedAt', ronin?.updatedAt],
  ]);

  for (const [key, value] of Object.entries(values)) {
    properties.set(key, value);
  }

  return Object.fromEntries(properties);
};

const OPERATOR_TO_ASSERTION_MAP = {
  contains: 'containing' as const,
  ends_with: 'endingWith' as const,
  eq: 'being' as const,
  gt: 'greaterThan' as const,
  gte: 'greaterOrEqual' as const,
  lt: 'lessThan' as const,
  lte: 'lessOrEqual' as const,
  ne: 'notBeing' as const,
  starts_with: 'startingWith' as const,
} satisfies Record<string, string>;

/**
 * Attempts to map a Better Auth SQL operator to a RONIN query assertion.
 *
 * Such as `eq` to `being`, `gt` to `greaterThan`, etc.
 *
 * @param operator - The stringified operator to map
 * @param value - The value to be used in the assertion
 *
 * @returns Either the value provided or an object with the assertion
 */
export const operatorToAssertion = <T = unknown>(
  operator: string,
  value: T,
): T | object => {
  if (operator in OPERATOR_TO_ASSERTION_MAP) {
    const typedOperator = operator as keyof typeof OPERATOR_TO_ASSERTION_MAP;
    return {
      [OPERATOR_TO_ASSERTION_MAP[typedOperator]]: value,
    };
  }

  return value;
};
