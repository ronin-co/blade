import { RONIN_SCHEMA_TEMP_SUFFIX } from '@/src/utils/misc';
import type { Model, ModelField, ModelIndex } from 'blade-compiler';

export type Query = string;
export type Queries = Array<Query>;

/**
 * Generates a RONIN query to drop a model.
 *
 * @param modelSlug - The identifier for the model.
 *
 * @returns A string representing the RONIN drop model query.
 *
 * @example
 * ```typescript
 * dropModelQuery('user') // Output: drop.model("user")
 * ```
 */
export const dropModelQuery = (modelSlug: string): Query => {
  return `drop.model("${modelSlug}")`;
};

/**
 * Generates a RONIN query to create a model.
 *
 * @param model - The model to create.
 *
 * @returns A string representing the RONIN create model query.
 *
 * @example
 * ```typescript
 * createModelQuery('user') // Output: create.model({slug:'user'})
 * createModelQuery('user', { pluralSlug: 'users' }) // Output: create.model({slug:'user',pluralSlug:'users'})
 * ```
 */
export const createModelQuery = (model: Model): Query => {
  const { indexes, ...rest } = model;
  return `create.model(${JSON.stringify({ ...rest, indexes })})`;
};

/**
 * Generates a RONIN query to create a field in a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param field - The field configuration to create.
 *
 * @returns A string representing the RONIN create field query.
 *
 * @example
 * ```typescript
 * createFieldQuery('user', { slug: 'email', type: 'string', unique: true })
 * // Output: alter.model('user').create.field({"slug":"email","type":"string","unique":true})
 * ```
 */
export const createFieldQuery = (modelSlug: string, field: ModelField): Query => {
  return `alter.model('${modelSlug}').create.field(${JSON.stringify(field)})`;
};

/**
 * Generates a RONIN query to modify a field in a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param fieldSlug - The identifier for the field to modify.
 * @param fieldTo - The new field properties.
 *
 * @returns A string representing the RONIN set field query.
 *
 * @example
 * ```typescript
 * setFieldQuery('user', 'email', { unique: true })
 * // Output: alter.model("user").alter.field("email").to({"unique":true})
 * ```
 */
export const setFieldQuery = (
  modelSlug: string,
  fieldSlug: string,
  fieldTo: Partial<ModelField>,
): Query => {
  return `alter.model("${modelSlug}").alter.field("${fieldSlug}").to(${JSON.stringify(fieldTo)})`;
};

/**
 * Generates a RONIN query to drop a field from a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param fieldSlug - The identifier for the field to drop.
 *
 * @returns A string representing the RONIN drop field query.
 *
 * @example
 * ```typescript
 * dropFieldQuery('user', 'email') // Output: alter.model("user").drop.field("email")
 * ```
 */
export const dropFieldQuery = (modelSlug: string, fieldSlug: string): Query => {
  return `alter.model("${modelSlug}").drop.field("${fieldSlug}")`;
};

/**
 * Generates RONIN queries to create a temporary model for field updates.
 *
 * @param modelSlug - The identifier for the model.
 * @param fields - The fields to include in the temporary model.
 * @param indexes - The indexes to include in the temporary model.
 * @param customQueries - Optional additional queries to execute.
 *
 * @returns An array of RONIN queries for the temporary model operations.
 *
 * @example
 * ```typescript
 * createTempModelQuery('user', [{slug: 'email', type: 'string'}])
 * // Output: [
 * //   'create.model({slug:"RONIN_TEMP_user",fields:[{slug:"email",type:"string"}]})',
 * //   'drop.model("user")',
 * //   'alter.model("RONIN_TEMP_user").to({slug: "user"})'
 * // ]
 * ```
 */
export const createTempModelQuery = (
  model: Model,
  options?: {
    customQueries?: Array<string>;
    includeFields?: Array<ModelField>;
    name?: string;
    pluralName?: string;
    pluralSlug?: string;
    idPrefix?: string;
  },
): Queries => {
  const { slug, pluralSlug, fields, indexes: _indexes, ...rest } = model;
  const queries: Queries = [];

  const tempModelSlug = `${RONIN_SCHEMA_TEMP_SUFFIX}${slug}`;
  const tempModelPluralSlug = pluralSlug
    ? `${RONIN_SCHEMA_TEMP_SUFFIX}${pluralSlug}`
    : `${RONIN_SCHEMA_TEMP_SUFFIX}${options?.pluralSlug}`;

  // Create a copy of the model.
  queries.push(
    createModelQuery({
      slug: tempModelSlug,
      ...(pluralSlug ? { pluralSlug: tempModelPluralSlug } : {}),
      fields,
      idPrefix: options?.idPrefix ?? slug.slice(0, 3),
      ...rest,
    }),
  );

  // Move all the data to the copied model.
  queries.push(
    `add.${tempModelPluralSlug}.with(() => get.${pluralSlug ?? options?.pluralSlug}(${
      options?.includeFields
        ? JSON.stringify({ selecting: options.includeFields.map((field) => field.slug) })
        : ''
    }))`,
  );

  if (options?.customQueries) {
    queries.push(...options.customQueries);
  }

  // Delete the original model.
  queries.push(dropModelQuery(slug));

  // Rename the copied model to the original model.
  queries.push(
    `alter.model("${tempModelSlug}").to({slug: "${slug}", name: "${options?.name}", pluralName: "${options?.pluralName}"${model.pluralSlug ? `, pluralSlug: "${model.pluralSlug}"` : ''}})`,
  );

  return queries;
};

/**
 * Generates a RONIN query to create a temporary column for field updates.
 *
 * @param modelSlug - The identifier for the model.
 * @param field - The field configuration to create.
 *
 * @returns A string representing the RONIN create field query.
 */
export const createTempColumnQuery = (
  modelSlug: string,
  pluralSlug: string,
  field: ModelField,
  _indexes: Array<ModelIndex>,
): Queries => {
  const queries: Queries = [];
  // 1. Create a temporary field with the new desired type and constraints.
  // The temp field name is prefixed with RONIN_SCHEMA_TEMP_ to avoid conflicts.
  queries.push(
    createFieldQuery(modelSlug, {
      ...field,
      slug: `${RONIN_SCHEMA_TEMP_SUFFIX}${field.slug}`,
    }),
  );

  const tempFieldSlug = `${RONIN_SCHEMA_TEMP_SUFFIX}${field.slug}`;
  // 2. Copy all data from the original field to the temporary field.
  // This preserves the data while we make the schema changes.
  queries.push(
    `set${modelSlug.includes('.') ? `["${pluralSlug}"]` : `.${pluralSlug}`}.to${
      field.slug.includes('.') ? `["${tempFieldSlug}"]` : `.${tempFieldSlug}`
    }(f => ${field.slug.includes('.') ? `f["${field.slug}"]` : `f.${field.slug}`})`,
  );

  // 3. Remove the original field now that data is safely copied.
  // This is needed before we can rename the temp field to take its place.
  queries.push(dropFieldQuery(modelSlug, field.slug));

  // 4. Rename the temporary field to the original field name.
  // This completes the field modification while preserving the data.
  queries.push(renameFieldQuery(modelSlug, tempFieldSlug, field.slug));

  return queries;
};

/**
 * Generates a RONIN query to rename a model.
 *
 * @param modelSlug - The current model identifier.
 * @param newModelSlug - The new model identifier.
 *
 * @returns A string representing the query.
 *
 * @example
 * ```typescript
 * renameModelQuery('user', 'account') // Output: alter.model("user").to({slug: "account"})
 * ```
 */
export const renameModelQuery = (modelSlug: string, newModelSlug: string): Query => {
  return `alter.model("${modelSlug}").to({slug: "${newModelSlug}"})`;
};

/**
 * Generates a RONIN query to rename a field within a model.
 *
 * @param modelSlug - The identifier for the model.
 * @param from - The current field identifier.
 * @param to - The new field identifier.
 *
 * @returns A string representing the query.
 *
 * @example
 * ```typescript
 * renameFieldQuery('user', 'email', 'emailAddress')
 * // Output: alter.model("user").alter.field("email").to({slug: "emailAddress"})
 * ```
 */
export const renameFieldQuery = (modelSlug: string, from: string, to: string): Query => {
  return `alter.model("${modelSlug}").alter.field("${from}").to({slug: "${to}"})`;
};

/**
 * Generates a RONIN query to remove an index from a model.
 *
 * @param modelSlug - The singular identifier for the model.
 * @param indexSlug - The slug of the index to remove.
 *
 * @returns A string representing the query.
 */
export const dropIndexQuery = (modelSlug: string, indexSlug: string): Query => {
  return `alter.model("${modelSlug}").drop.index("${indexSlug}")`;
};

/**
 * Generates a RONIN query to add an index to a model.
 *
 * @param modelSlug - The singular identifier for the model.
 * @param index - The index to add.
 *
 * @returns A string representing the query.
 */
export const createIndexQuery = (modelSlug: string, index: ModelIndex): Query => {
  return `alter.model("${modelSlug}").create.index(${JSON.stringify(index)})`;
};
