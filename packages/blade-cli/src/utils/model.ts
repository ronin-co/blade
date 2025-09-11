import { runQueries } from 'blade-client';
import type { Model, ModelField, Query } from 'blade-compiler';

import { IGNORED_FIELDS } from '@/src/utils/migration';

/**
 * A model with fields in array format.
 */
export type ModelWithFieldsArray = Omit<Model, 'fields'> & { fields: Array<ModelField> };

/**
 * Fetches and formats schema models from either production API or local database.
 *
 * @param token - Optional authentication token for production API requests.
 * @param fieldArray — Whether to provide an array of fields.
 *
 * @returns Promise resolving to an array of formatted Model objects.
 *
 * @throws Error if production API request fails.
 */
export const getModels = async (options?: {
  token?: string;
  fieldArray?: boolean;
}): Promise<Array<ModelWithFieldsArray | Model>> => {
  const queries: Array<Query> = [{ list: { models: null } }];
  const { token, fieldArray = true } = options || {};

  const [models] = (await runQueries(queries, {
    token,
    models: [],
  })) as unknown as [Array<Model>];

  if (fieldArray) {
    return models.map((model) => ({
      ...model,
      fields: convertObjectToArray(model.fields || {})?.filter(
        (field) => !IGNORED_FIELDS.includes(field.slug),
      ),
    }));
  }

  return models;
};

/**
 * Converts an object of fields, indexes, or triggers into an array of objects with slugs.
 *
 * @param input - Object containing field, index, or trigger definitions.
 *
 * @returns Array of objects with slugs.
 */
export const convertObjectToArray = <T extends { slug: string }>(
  obj: Pick<Model, 'fields' | 'indexes'> | undefined,
): Array<T> => {
  if (!obj || JSON.stringify(obj) === '{}') return [];

  return Object.entries(obj).map(([key, value]) => ({
    slug: key,
    ...value,
  })) as Array<T>;
};

/**
 * Converts an array of field objects with slugs into an object keyed by slug.
 *
 * @param fields - Array of field objects with slugs.
 *
 * @returns Object with fields keyed by slug.
 */
export const convertArrayFieldToObject = (
  fields: Array<ModelField> | undefined,
): Pick<Model, 'fields'> => {
  if (!fields) return {};

  return fields.reduce<Record<string, Omit<ModelField, 'slug'>>>((obj, field) => {
    const { slug, ...rest } = field;
    obj[slug] = rest;
    return obj;
  }, {});
};

/**
 * Converts a model's fields from object format to array format.
 *
 * @param model - Model with fields in object format.
 *
 * @returns Model with fields converted to array format.
 */
export const convertModelToArrayFields = (model: Model): ModelWithFieldsArray => {
  if (JSON.stringify(model) === '{}') return {} as ModelWithFieldsArray;
  return { ...model, fields: convertObjectToArray(model?.fields || {}) };
};

/**
 * Converts a model's fields from array format to object format.
 *
 * @param model - Model with fields in array format.
 *
 * @returns Model with fields converted to object format.
 */
export const convertModelToObjectFields = (model: ModelWithFieldsArray): Model => {
  return { ...model, fields: convertArrayFieldToObject(model.fields) };
};
