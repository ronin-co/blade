import type { MigrationOptionsWithName } from '@/src/utils/migration';
import { RONIN_SCHEMA_TEMP_SUFFIX } from '@/src/utils/misc';
import {
  type ModelWithFieldsArray,
  convertArrayFieldToObject,
  convertObjectToArray,
} from '@/src/utils/model';
import {
  type Queries,
  createFieldQuery,
  createTempColumnQuery,
  createTempModelQuery,
  dropFieldQuery,
  renameFieldQuery,
} from '@/src/utils/queries';
import { confirm, input, select } from '@inquirer/prompts';
import type { Model, ModelField } from 'blade-compiler';

/**
 * A utility class for comparing and generating migration queries between two model definitions.
 * This class is responsible for detecting differences between local and remote model fields,
 * and generating the necessary SQL queries to synchronize them.
 *
 * The comparison process handles:
 * - Field additions
 * - Field deletions
 * - Field renames
 * - Field type changes
 * - Constraint modifications (required, unique)
 * - Default value changes
 *
 * @example
 * ```typescript
 * const localModel = { slug: 'user', fields: [...] };
 * const remoteModel = { slug: 'user', fields: [...] };
 * const comparer = new CompareModels(localModel, remoteModel);
 * const migrationQueries = await comparer.diff();
 * ```
 */
export class CompareModels {
  queries: Queries = [];
  #fieldComparisonCache = new Map<string, boolean>();

  #definedModel: ModelWithFieldsArray;
  #existingModel: ModelWithFieldsArray;
  #localModelSlug: string;
  #options?: MigrationOptionsWithName;

  constructor(
    definedModel: ModelWithFieldsArray,
    existingModel: ModelWithFieldsArray,
    options?: MigrationOptionsWithName,
  ) {
    this.#definedModel = definedModel;
    this.#existingModel = existingModel;
    this.#localModelSlug = definedModel.slug;
    this.#options = options;
  }

  /**
   * Handles migration of a required field by prompting for a default value and generating
   * the necessary queries.
   * This is needed when adding a required constraint to an existing field or creating
   * a new required field.
   *
   * @param modelSlug - The slug/identifier of the model containing the field.
   * @param field - The field being made required.
   * @param definedFields - The complete list of fields defined for the model.
   * @param options - Optional configuration.
   *
   * @returns Object containing:
   *   - defaultValue: The chosen default value for the required field.
   *   - definedFields: Updated field definitions with required constraints temporarily removed.
   *   - queries: Array of migration queries to set default values and add required constraints.
   */
  async handleRequiredField(
    modelSlug: string,
    pluralSlug: string,
    field: ModelField,
    definedFields: Array<ModelField> | undefined,
  ): Promise<{
    defaultValue: string | boolean | undefined;
    definedFields: Array<ModelField> | undefined;
    queries: Queries;
  }> {
    let defaultValue: string | boolean | undefined;
    if (field.type === 'boolean') {
      defaultValue =
        this.#options?.requiredDefault ||
        (await select({
          message: `Field ${modelSlug}.${field.slug} is required. Select a default value (or manually drop all records):`,
          choices: [
            { name: 'True', value: true },
            { name: 'False', value: false },
          ],
        }));
    } else {
      defaultValue =
        this.#options?.requiredDefault ||
        (await input({
          message: `Field ${modelSlug}.${field.slug} is required. Enter a default value (or manually drop all records):`,
        }));
    }

    // Temporarily remove required constraints to allow setting default values.
    const updatedFields = definedFields?.map((f) => ({
      ...f,
      required: false,
    }));

    const tempModelSlug = `${RONIN_SCHEMA_TEMP_SUFFIX}${pluralSlug}`;

    const queries = [
      // Set the default value for all existing records.
      `set${tempModelSlug.includes('.') ? `["${tempModelSlug}"]` : `.${tempModelSlug}`}({with: {${field.slug}: {being: null}},to:{"${field.slug}": ${
        typeof defaultValue === 'string' ? `"${defaultValue}"` : defaultValue
      }}})`,
      // Re-add the NOT NULL constraint after defaults are set.
      `alter.model("${tempModelSlug}").alter.field("${field.slug}").to({required: true})`,
    ];

    return {
      defaultValue,
      definedFields: updatedFields,
      queries,
    };
  }

  /**
   * Generates the difference (migration steps) between local and remote fields of a model.
   *
   * @returns An array of migration steps (as SQL query strings).
   */
  async diff(): Promise<Queries> {
    const diff: Queries = [];
    const definedFields = this.#definedModel.fields;
    const existingFields = this.#existingModel.fields;

    const fieldsToBeRenamed = this.fieldsToRename();

    let fieldsToAdd = this.fieldsToCreate(definedFields, existingFields);
    let fieldsToDelete = this.fieldsToDrop(definedFields, existingFields);
    const queriesForAdjustment = this.fieldsToAdjust(definedFields, existingFields);

    if (fieldsToBeRenamed.length > 0) {
      // Ask if the user wants to rename a field.
      for (const field of fieldsToBeRenamed) {
        const confirmRename =
          this.#options?.rename ||
          (await confirm({
            message: `Did you mean to rename field: ${this.#localModelSlug}.${field.from.slug} -> ${this.#localModelSlug}.${field.to.slug}`,
            default: true,
          }));

        if (confirmRename) {
          fieldsToDelete = fieldsToDelete.filter((s) => s.slug !== field.from.slug);
          fieldsToAdd = fieldsToAdd.filter((s) => s.slug !== field.to.slug);
          if (field.from.type === 'link') {
            diff.push(
              ...createTempModelQuery(
                {
                  slug: this.#localModelSlug,
                  fields: convertArrayFieldToObject([
                    { ...field.to, slug: field.from.slug },
                    ...definedFields.filter((local) => local.slug !== field.to.slug),
                  ]),
                  indexes: this.#definedModel.indexes,
                },
                {
                  name: this.#options?.name,
                  pluralName: this.#options?.pluralName,
                  customQueries: [
                    renameFieldQuery(
                      `${RONIN_SCHEMA_TEMP_SUFFIX}${this.#localModelSlug}`,
                      field.from.slug,
                      field.to.slug,
                    ),
                  ],
                  pluralSlug: this.#existingModel.pluralSlug ?? this.#options?.pluralSlug,
                  idPrefix: this.#existingModel.idPrefix,
                },
              ),
            );
          } else {
            diff.push(
              renameFieldQuery(this.#localModelSlug, field.from.slug, field.to.slug),
            );
          }
        }
      }
    }

    const createFieldsQueries = await this.createFields(
      fieldsToAdd,
      this.#localModelSlug,
      this.#existingModel.pluralSlug ?? this.#options?.pluralSlug ?? '',
      definedFields,
      existingFields,
    );

    diff.push(...createFieldsQueries);
    if (
      !(
        createFieldsQueries.length > 0 &&
        createFieldsQueries.find((q) => q.includes(RONIN_SCHEMA_TEMP_SUFFIX))
      )
    ) {
      diff.push(
        ...this.deleteFields(fieldsToDelete, this.#localModelSlug, definedFields),
      );
    }

    for (const field of queriesForAdjustment || []) {
      // SQLite has limited ALTER TABLE support. When adding UNIQUE or NOT NULL constraints,
      // we must recreate the entire table. For other constraint changes, we can use a more
      // efficient approach: create a temporary column, copy the data, drop the old column,
      // and rename the temporary one.
      const existingField = existingFields.find((f) => f.slug === field.slug);
      if (field.unique || existingField?.unique) {
        diff.push(
          ...this.adjustFields(
            {
              slug: this.#localModelSlug,
              fields: convertArrayFieldToObject(definedFields),
              indexes: this.#definedModel.indexes,
            },
            {
              name: this.#options?.name,
              pluralName: this.#options?.pluralName,
            },
          ),
        );
      } else if (field.required && !field.defaultValue) {
        const { definedFields: updatedFields, queries } = await this.handleRequiredField(
          this.#localModelSlug,
          this.#existingModel.pluralSlug ?? this.#options?.pluralSlug ?? '',
          field,
          definedFields,
        );

        diff.push(
          ...createTempModelQuery(
            {
              slug: this.#localModelSlug,
              fields: convertArrayFieldToObject(updatedFields || []),
              indexes: this.#definedModel.indexes,
            },
            {
              name: this.#options?.name,
              pluralName: this.#options?.pluralName,
              customQueries: queries,
              includeFields: existingFields,
              pluralSlug: this.#existingModel.pluralSlug ?? this.#options?.pluralSlug,
              idPrefix: this.#existingModel.idPrefix,
            },
          ),
        );
      } else if (field.type === 'link' && field.kind === 'many') {
        diff.push(
          ...this.adjustFields(
            {
              slug: this.#localModelSlug,
              fields: convertArrayFieldToObject(definedFields),
              indexes: this.#definedModel.indexes,
            },
            {
              name: this.#options?.name,
              pluralName: this.#options?.pluralName,
            },
          ),
        );
      } else {
        diff.push(
          ...createTempColumnQuery(
            this.#localModelSlug,
            this.#existingModel.pluralSlug ?? this.#options?.pluralSlug ?? '',
            field,
            convertObjectToArray(this.#definedModel.indexes),
          ),
        );
      }
    }

    this.queries = diff;
    return diff;
  }

  /**
   * Determines the fields that need to be renamed.
   *
   * @param definedFields - The fields defined locally.
   * @param existingFields - The fields defined remotely.
   *
   * @returns An array of fields to rename.
   */
  fieldsToRename(): Array<{ from: ModelField; to: ModelField }> {
    const fieldsToCreated = this.fieldsToCreate(
      this.#definedModel.fields,
      this.#existingModel.fields,
    );
    const fieldsToDropped = this.fieldsToDrop(
      this.#definedModel.fields,
      this.#existingModel.fields,
    );

    const fieldsToRename: Array<{ from: ModelField; to: ModelField }> = [];
    const processedSlugs = new Set<string>();

    for (const field of fieldsToCreated) {
      if (processedSlugs.has(field.slug)) continue;

      const currentField = fieldsToDropped.find((s) => {
        if (processedSlugs.has(s.slug)) return false;

        const key = `${field.slug}-${s.slug}`;
        if (this.#fieldComparisonCache.has(key)) {
          return this.#fieldComparisonCache.get(key);
        }

        const isMatch =
          field.type === s.type &&
          field.unique === s.unique &&
          field.required === s.required;

        this.#fieldComparisonCache.set(key, isMatch);
        return isMatch;
      });

      if (currentField) {
        fieldsToRename.push({ from: currentField, to: field });
        processedSlugs.add(currentField.slug);
        processedSlugs.add(field.slug);
      }
    }

    return fieldsToRename;
  }

  /**
   * Determines the necessary adjustments for model fields to have code match the database.
   *
   * @param definedFields - Model fields defined in the code.
   * @param existingFields - Model fields in the database.
   * @param modelSlug - Slug for the model.
   *
   * @returns An array of SQL queries for adjustment, or `undefined` if none are needed.
   */
  fieldsToAdjust(
    definedFields: Array<ModelField>,
    existingFields: Array<ModelField>,
  ): Array<ModelField> | undefined {
    if (definedFields.length === 0 || existingFields.length === 0) {
      return undefined;
    }

    const diff: Array<ModelField> = [];
    const existingFieldsMap = new Map(existingFields.map((field) => [field.slug, field]));

    for (const local of definedFields) {
      const remote = existingFieldsMap.get(local.slug);
      if (remote && CompareModels.fieldsAreDifferent(local, remote)) {
        diff.push(local);
      }
    }

    return diff.length > 0 ? diff : undefined;
  }

  /**
   * Creates a temporary table to handle field adjustments in SQLite. Since SQLite doesn't
   * support direct column alterations (except for renaming), the function:
   *
   * 1. Creates a temporary table with the new model
   * 2. Copies data from original table
   * 3. Drops the original table
   * 4. Renames the temporary table to the original name
   * 5. Recreates indexes
   *
   * @param modelSlug - Slug of the model being adjusted.
   * @param fields - Array of fields with their new definitions.
   * @param indexes - Array of indexes to recreate after table swap.
   *
   * @returns Array of SQL queries to perform the table recreation.
   */
  adjustFields(model: Model, options?: MigrationOptionsWithName): Queries {
    return createTempModelQuery(model, {
      ...options,
      name: this.#options?.name,
      pluralName: this.#options?.pluralName,
      pluralSlug: this.#existingModel.pluralSlug ?? this.#options?.pluralSlug,
      idPrefix: this.#existingModel.idPrefix,
    });
  }

  /**
   * Identifies fields that need to be created in the database.
   *
   * @param definedFields - Fields defined in the code.
   * @param existingFields - Fields present in the database.
   *
   * @returns An array of fields to create in the database.
   */
  fieldsToCreate(
    definedFields: Array<ModelField>,
    existingFields: Array<ModelField>,
  ): Array<ModelField> {
    if (definedFields.length === 0) return [];
    if (existingFields.length === 0) return definedFields;

    const existingSlugs = new Set(existingFields.map((field) => field.slug));
    return definedFields.filter((field) => !existingSlugs.has(field.slug));
  }

  /**
   * Generates SQL queries to create new fields in the database.
   *
   * @param fields - Fields to add to the database.
   * @param modelSlug - Slug of the model.
   *
   * @returns An array of SQL queries for creating fields.
   */
  async createFields(
    fields: Array<ModelField>,
    modelSlug: string,
    pluralSlug: string,
    definedFields?: Array<ModelField>,
    existingFields?: Array<ModelField>,
  ): Promise<Queries> {
    const diff: Queries = [];

    for (const fieldToAdd of fields) {
      // If the field is unique, we need to create a temporary model with the existing fields
      // and the new field. This is because SQLite doesn't support adding a UNIQUE constraint
      // to an existing column.
      if (fieldToAdd.unique) {
        const existingFields = definedFields?.filter(
          (f) => !fields.find((f2) => f2.slug === f.slug),
        );

        if (fieldToAdd.required && !fieldToAdd.defaultValue) {
          const { definedFields: updatedFields, queries } =
            await this.handleRequiredField(
              modelSlug,
              pluralSlug,
              fieldToAdd,
              definedFields,
            );

          return createTempModelQuery(
            {
              slug: modelSlug,
              fields: convertArrayFieldToObject(updatedFields || []),
            },
            {
              customQueries: queries,
              includeFields: existingFields,
              name: this.#options?.name,
              pluralName: this.#options?.pluralName,
              pluralSlug: this.#existingModel.pluralSlug ?? this.#options?.pluralSlug,
              idPrefix: this.#existingModel.idPrefix,
            },
          );
        }

        return createTempModelQuery(
          {
            slug: modelSlug,
            fields: convertArrayFieldToObject(definedFields || []),
          },
          {
            includeFields: existingFields,
            name: this.#options?.name,
            pluralName: this.#options?.pluralName,
            pluralSlug: this.#existingModel.pluralSlug ?? this.#options?.pluralSlug,
            idPrefix: this.#existingModel.idPrefix,
          },
        );
      }

      // Handle required fields by prompting for default value since SQLite doesn't allow
      // adding NOT NULL columns without defaults.
      if (fieldToAdd.required && !fieldToAdd.defaultValue) {
        const { defaultValue } = await this.handleRequiredField(
          modelSlug,
          pluralSlug,
          fieldToAdd,
          definedFields,
        );

        // Create field without NOT NULL constraint.
        diff.push(createFieldQuery(modelSlug, { ...fieldToAdd, required: false }));
        // Now set a placeholder value.
        diff.push(
          `set${modelSlug.includes('.') ? `["${modelSlug}"]` : `.${modelSlug}`}.to({"${
            fieldToAdd.slug
          }": ${typeof defaultValue === 'boolean' ? defaultValue : `"${defaultValue}"`}})`,
        );
        // Now add the NOT NULL constraint.
        diff.push(
          `alter.model("${modelSlug}").alter.field("${fieldToAdd.slug}").to({required: true})`,
        );
        return diff;
      }

      // If the field contains an expression as default value, we need to create a temporary
      // model with the existing fields and the new field.
      if (fieldToAdd.defaultValue && typeof fieldToAdd.defaultValue === 'object') {
        diff.push(
          ...createTempModelQuery(
            {
              slug: modelSlug,
              fields: convertArrayFieldToObject(definedFields),
            },
            {
              includeFields: existingFields,
              name: this.#options?.name,
              pluralName: this.#options?.pluralName,
              pluralSlug: this.#existingModel.pluralSlug ?? this.#options?.pluralSlug,
              idPrefix: this.#existingModel.idPrefix,
            },
          ),
        );
        return diff;
      }

      diff.push(createFieldQuery(modelSlug, fieldToAdd));
    }
    return diff;
  }

  /**
   * Identifies fields that should be removed from the database.
   *
   * @param definedFields - Fields defined in the code.
   * @param existingFields - Fields present in the database.
   *
   * @returns An array of fields to remove from the database.
   */
  fieldsToDrop(
    definedFields: Array<ModelField>,
    existingFields: Array<ModelField>,
  ): Array<ModelField> {
    if (existingFields.length === 0) return [];
    if (definedFields.length === 0) return existingFields;

    const definedSlugs = new Set(definedFields.map((field) => field.slug));
    return existingFields.filter((field) => !definedSlugs.has(field.slug));
  }

  /**
   * Generates SQL queries to delete fields from the database.
   *
   * @param fields - Fields to delete.
   * @param modelSlug - Slug of the model.
   *
   * @returns An array of SQL queries for deleting fields.
   */
  deleteFields(
    fieldsToDrop: Array<ModelField>,
    modelSlug: string,
    fields: Array<ModelField>,
  ): Queries {
    const diff: Queries = [];
    for (const fieldToDrop of fieldsToDrop) {
      if (fieldToDrop.unique) {
        return createTempModelQuery(
          {
            slug: modelSlug,
            fields: convertArrayFieldToObject(fields),
          },
          {
            includeFields: fields,
            name: this.#options?.name,
            pluralName: this.#options?.pluralName,
            pluralSlug: this.#existingModel.pluralSlug ?? this.#options?.pluralSlug,
            idPrefix: this.#existingModel.idPrefix,
          },
        );
      }
      diff.push(dropFieldQuery(modelSlug, fieldToDrop.slug));
    }

    return diff;
  }

  /**
   * Compares two fields to determine if they are different.
   *
   * @returns True if the fields are different, false otherwise.
   */
  static fieldsAreDifferent(local: ModelField, remote: ModelField): boolean {
    const { name: localName, ...localAttributes } = local;
    const { name: remoteName, ...remoteAttributes } = remote;

    return (
      (localName && localName !== remoteName) ||
      JSON.stringify(localAttributes) !== JSON.stringify(remoteAttributes)
    );
  }
}
