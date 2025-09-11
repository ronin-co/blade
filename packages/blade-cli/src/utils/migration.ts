import type { parseArgs } from 'node:util';
import { CompareModels } from '@/src/utils/field';
import { type BaseFlags, areArraysEqual } from '@/src/utils/misc';
import {
  type ModelWithFieldsArray,
  convertModelToArrayFields,
  convertModelToObjectFields,
} from '@/src/utils/model';
import {
  type Queries,
  createIndexQuery,
  createModelQuery,
  createTempModelQuery,
  dropIndexQuery,
  dropModelQuery,
  renameModelQuery,
} from '@/src/utils/queries';
import { confirm } from '@inquirer/prompts';
import type { Model } from 'blade-compiler';

/**
 * Options for migration operations.
 */
export interface MigrationOptions {
  /** Whether to automatically rename models without prompting. */
  rename?: boolean;
  /** Default value to use for required fields. */
  requiredDefault?: boolean | string;
  /** Whether to debug the migration process. */
  debug?: boolean;
}

/**
 * Options for migration operations that include model name and plural name.
 */
export interface MigrationOptionsWithName extends MigrationOptions {
  name?: string;
  pluralName?: string;
  pluralSlug?: string;
}

/**
 * Fields to ignore during migration.
 * These fields are not relevant for the migration process.
 */
export const IGNORED_FIELDS = [
  'id',
  'ronin',
  'ronin.updatedAt',
  'ronin.createdBy',
  'ronin.updatedBy',
  'ronin.createdAt',
  'ronin.locked',
];

/**
 * Command line flags for migration operations.
 */
export const MIGRATION_FLAGS = {
  sql: { type: 'boolean', short: 's', default: false },
  apply: { type: 'boolean', short: 'a', default: false },
  'skip-types': { type: 'boolean', default: false },
  'force-drop': { type: 'boolean', short: 'd', default: false },
  'force-create': { type: 'boolean', short: 'c', default: false },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

/**
 * Type definition for migration command flags.
 */
export type MigrationFlags = BaseFlags &
  Partial<Record<keyof typeof MIGRATION_FLAGS, boolean>>;

interface RenameResult {
  queries: Array<string>;
  excludeFromAdded?: Array<ModelWithFieldsArray>;
  excludeFromDropped?: Array<ModelWithFieldsArray>;
}

/**
 * Class for generating migration queries.
 *
 * @param definedModels - The models defined in code.
 * @param existingModels - The models in the database.
 * @param options - The options for the migration.
 *
 * @example
 * ```typescript
 * const migration = new Migration([TestA], [TestB]);
 * const queries = await migration.diff();
 * ```
 */
export class Migration {
  queries: Queries = [];
  options?: MigrationOptions;

  #definedModels: Array<ModelWithFieldsArray> = [];
  #existingModels: Array<ModelWithFieldsArray> = [];

  constructor(
    definedModels?: Array<Model>,
    existingModels?: Array<Model>,
    options?: MigrationOptions,
  ) {
    this.#definedModels = definedModels?.map(convertModelToArrayFields) || [];
    this.#existingModels = existingModels?.map(convertModelToArrayFields) || [];
    this.options = options;
  }

  /**
   * Generates the difference (migration steps) between models defined in code and models
   * in the database.
   *
   * @returns An array of migration steps (as code strings).
   */
  async diff(): Promise<Queries> {
    const queries: Queries = [];

    const renamedModels = await this.#processRenamedModels();
    queries.push(...renamedModels.queries);

    queries.push(...this.#generateAddModelQueries(renamedModels.excludeFromAdded));
    queries.push(...this.#generateDropModelQueries(renamedModels.excludeFromDropped));

    queries.push(...this.#generateMetaChangeQueries());
    queries.push(...(await this.#generateFieldChangeQueries()));

    queries.push(...this.#generateIndexRecreationQueries());

    this.queries = queries;
    return queries;
  }

  async #processRenamedModels(): Promise<RenameResult> {
    const modelsToRename = this.#findModelsToRename();
    return await this.#generateRenameQueries(modelsToRename);
  }

  #generateAddModelQueries(excludeModels?: Array<ModelWithFieldsArray>): Array<string> {
    const modelsToAdd = this.#findModelsToAdd(excludeModels);
    return modelsToAdd.map(createModelQuery);
  }

  #generateDropModelQueries(excludeModels?: Array<ModelWithFieldsArray>): Array<string> {
    const modelsToDrop = this.#findModelsToDrop(excludeModels);
    return modelsToDrop.map((model) => dropModelQuery(model.slug));
  }

  #generateMetaChangeQueries(): Array<string> {
    const queries: Array<string> = [];

    for (const definedModel of this.#definedModels) {
      const existingModel = this.#existingModels.find(
        (model) => model.slug === definedModel.slug,
      );

      if (existingModel) {
        queries.push(...this.#generateModelMetaQueries(definedModel, existingModel));
      }
    }

    return queries;
  }

  async #generateFieldChangeQueries(): Promise<Array<string>> {
    const queries: Array<string> = [];

    for (const definedModel of this.#definedModels) {
      const existingModel = this.#existingModels.find(
        (model) => model.slug === definedModel.slug,
      );

      if (existingModel) {
        const compareOptions = {
          ...this.options,
          name: existingModel.name,
          pluralName: existingModel.pluralName,
        };

        const compareModels = new CompareModels(
          definedModel,
          existingModel,
          compareOptions,
        );
        queries.push(...(await compareModels.diff()));
      }
    }

    return queries;
  }

  #generateModelMetaQueries(
    definedModel: ModelWithFieldsArray,
    existingModel: ModelWithFieldsArray,
  ): Array<string> {
    const queries: Array<string> = [];

    if (definedModel.idPrefix && definedModel.idPrefix !== existingModel.idPrefix) {
      const modelWithUpdatedPrefix = {
        ...definedModel,
        fields: existingModel.fields,
      };

      queries.push(
        ...createTempModelQuery(convertModelToObjectFields(modelWithUpdatedPrefix), {
          name: existingModel.name,
          pluralName: existingModel.pluralName,
          pluralSlug: existingModel.pluralSlug,
          idPrefix: existingModel.idPrefix,
        }),
      );
    } else if (definedModel.name && definedModel.name !== existingModel.name) {
      queries.push(
        `alter.model("${definedModel.slug}").to({name: "${definedModel.name}"})`,
      );
    }

    return queries;
  }

  async #generateRenameQueries(
    modelsToRename: Array<{ to: ModelWithFieldsArray; from: ModelWithFieldsArray }>,
  ): Promise<RenameResult> {
    if (modelsToRename.length === 0) {
      return { queries: [] };
    }

    const queries: Array<string> = [];
    const excludeFromAdded: Array<ModelWithFieldsArray> = [];
    const excludeFromDropped: Array<ModelWithFieldsArray> = [];

    for (const { to, from } of modelsToRename) {
      const shouldRename =
        this.options?.rename ||
        (await confirm({
          message: `Did you mean to rename model: ${from.slug} -> ${to.slug}`,
          default: true,
        }));

      if (shouldRename) {
        excludeFromAdded.push(to);
        excludeFromDropped.push(from);
        queries.push(renameModelQuery(from.slug, to.slug));
      }
    }

    return {
      queries,
      excludeFromAdded,
      excludeFromDropped,
    };
  }

  #findModelsToRename(): Array<{ to: ModelWithFieldsArray; from: ModelWithFieldsArray }> {
    const addedModels = this.#findModelsToAdd().map(convertModelToArrayFields);
    const droppedModels = this.#findModelsToDrop().map(convertModelToArrayFields);

    const modelPairs: Array<{ to: ModelWithFieldsArray; from: ModelWithFieldsArray }> =
      [];

    for (const addedModel of addedModels) {
      const matchingDroppedModel = droppedModels.find((droppedModel) =>
        areArraysEqual(
          addedModel.fields?.map((field) => field.slug) || [],
          droppedModel.fields?.map((field) => field.slug) || [],
        ),
      );

      if (matchingDroppedModel) {
        modelPairs.push({ to: addedModel, from: matchingDroppedModel });
      }
    }

    return modelPairs;
  }

  #findModelsToAdd(excludeModels?: Array<ModelWithFieldsArray>): Array<Model> {
    return this.#definedModels
      .filter(
        (definedModel) =>
          !(
            this.#existingModels.some(
              (existingModel) => existingModel.slug === definedModel.slug,
            ) ||
            excludeModels?.some((excludeModel) => excludeModel.slug === definedModel.slug)
          ),
      )
      .map(convertModelToObjectFields);
  }

  #findModelsToDrop(excludeModels?: Array<ModelWithFieldsArray>): Array<Model> {
    return this.#existingModels
      .filter(
        (existingModel) =>
          !(
            this.#definedModels.some(
              (definedModel) => definedModel.slug === existingModel.slug,
            ) ||
            excludeModels?.some(
              (excludeModel) => excludeModel.slug === existingModel.slug,
            )
          ),
      )
      .map(convertModelToObjectFields);
  }

  #needsRecreation(
    definedModel: ModelWithFieldsArray,
    existingModel: ModelWithFieldsArray,
  ): boolean {
    if (!existingModel) return false;

    const compareModels = new CompareModels(definedModel, existingModel, {
      ...this.options,
      name: existingModel.name,
      pluralName: existingModel.pluralName,
    });

    const fieldsToAdjust =
      compareModels.fieldsToAdjust(
        definedModel.fields || [],
        existingModel.fields || [],
      ) || [];

    return fieldsToAdjust.length > 0;
  }

  #generateIndexRecreationQueries(): Array<string> {
    const queries: Array<string> = [];

    for (const definedModel of this.#definedModels) {
      const existingModel = this.#existingModels.find(
        (model) => model.slug === definedModel.slug,
      );

      if (!existingModel || this.#needsRecreation(definedModel, existingModel)) {
        continue;
      }

      queries.push(...this.#generateIndexDiffQueries(definedModel, existingModel));
    }

    return queries;
  }

  #generateIndexDiffQueries(
    definedModel: ModelWithFieldsArray,
    existingModel: ModelWithFieldsArray,
  ): Array<string> {
    const queries: Array<string> = [];
    const definedIndexes = definedModel.indexes || {};
    const existingIndexes = existingModel.indexes || {};

    for (const [indexSlug, indexDef] of Object.entries(definedIndexes)) {
      const existingIndex = existingIndexes[indexSlug];

      if (!existingIndex) {
        queries.push(
          createIndexQuery(definedModel.slug, {
            slug: indexSlug,
            ...indexDef,
          }),
        );
        continue;
      }

      if (JSON.stringify(indexDef) !== JSON.stringify(existingIndex)) {
        queries.push(dropIndexQuery(definedModel.slug, indexSlug));
        queries.push(
          createIndexQuery(definedModel.slug, {
            slug: indexSlug,
            ...indexDef,
          }),
        );
      }
    }

    return queries;
  }
}
