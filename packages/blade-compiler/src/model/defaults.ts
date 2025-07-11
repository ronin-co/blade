import { getModelBySlug, getSystemFields } from '@/src/model';
import type { Model, ModelField, ModelPreset, PartialModel } from '@/src/types/model';
import { QUERY_SYMBOLS } from '@/src/utils/constants';
import { convertToSnakeCase } from '@/src/utils/helpers';
import title from 'title';

/**
 * Converts a slug to a readable name by splitting it on uppercase characters
 * and returning it formatted as title case.
 *
 * @example
 * ```ts
 * slugToName('activeAt'); // 'Active At'
 * ```
 *
 * @param slug - The slug string to convert.
 *
 * @returns The formatted name in title case.
 */
export const slugToName = (slug: string): string => {
  // Split the slug by uppercase letters and join with a space
  const name = slug.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Convert the resulting string to title case using the 'title' library
  return title(name);
};

const VOWELS = ['a', 'e', 'i', 'o', 'u'];

/**
 * Pluralizes a singular English noun according to basic English pluralization rules.
 *
 * This function handles the following cases:
 * - **Words ending with a consonant followed by 'y'**: Replaces the 'y' with 'ies'.
 * - **Words ending with 's', 'ch', 'sh', or 'ex'**: Adds 'es' to the end of the word.
 * - **All other words**: Adds 's' to the end of the word.
 *
 * @example
 * ```ts
 * pluralize('baby');    // 'babies'
 * pluralize('key');     // 'keys'
 * pluralize('bus');     // 'buses'
 * pluralize('church');  // 'churches'
 * pluralize('cat');     // 'cats'
 * ```
 *
 * @param word - The singular noun to pluralize.
 *
 * @returns The plural form of the input word.
 */
const pluralize = (word: string): string => {
  const lastLetter = word.slice(-1).toLowerCase();
  const secondLastLetter = word.slice(-2, -1).toLowerCase();

  if (lastLetter === 'y' && !VOWELS.includes(secondLastLetter)) {
    // If the word ends with 'y' preceded by a consonant, replace 'y' with 'ies'
    return `${word.slice(0, -1)}ies`;
  }

  if (
    lastLetter === 's' ||
    word.slice(-2).toLowerCase() === 'ch' ||
    word.slice(-2).toLowerCase() === 'sh' ||
    word.slice(-2).toLowerCase() === 'ex'
  ) {
    // If the word ends with 's', 'ch', 'sh', or 'ex', add 'es'
    return `${word}es`;
  }

  // In all other cases, simply add 's'
  return `${word}s`;
};

type ComposableSettings =
  | 'slug'
  | 'pluralSlug'
  | 'name'
  | 'pluralName'
  | 'idPrefix'
  | 'table';

/**
 * A list of settings that can be automatically generated based on other settings.
 *
 * The first item in each tuple is the setting that should be generated, the second item
 * is the setting that should be used as a base, and the third item is the function that
 * should be used to generate the new setting.
 */
const modelAttributes: Array<
  [
    // The target attribute that is being generated.
    ComposableSettings,
    // The base attribute from which the aforementioned attribute is generated.
    ComposableSettings,
    // The transformation function for generating the new attribute.
    (arg: string) => string,
    // Whether the target attribute must be re-generated when the base attribute changes
    // during the altering of a model.
    boolean,
  ]
> = [
  ['pluralSlug', 'slug', pluralize, true],
  ['name', 'slug', slugToName, false],
  ['pluralName', 'pluralSlug', slugToName, false],
  ['idPrefix', 'slug', (slug: string) => slug.slice(0, 3).toLowerCase(), false],
  ['table', 'pluralSlug', convertToSnakeCase, true],
];

/**
 * Generates a unique identifier for a newly created record.
 *
 * @returns A string containing the ID.
 */
export const getRecordIdentifier = (prefix: string): string => {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
    .toLowerCase()}`;
};

/**
 * Sets default values for the attributes of a model (such as `name`, `pluralName`, etc).
 *
 * @param model - The model that should receive defaults.
 * @param isNew - Whether the model is being newly created.
 *
 * @returns The updated model.
 */
export const addDefaultModelAttributes = (model: PartialModel, isNew: boolean): Model => {
  const copiedModel = { ...model };

  // Generate a unique identifier for the model. We are generating these identifiers
  // within the compiler instead of the database because the compiler needs it for
  // internal comparisons, before the resulting statements hit the database.
  if (isNew && !copiedModel.id) copiedModel.id = getRecordIdentifier('mod');

  for (const [setting, base, generator, mustRegenerate] of modelAttributes) {
    // If an existing model is being altered, check whether the attribute must even be
    // re-generated from its base attribute, or whether it should stay outdated.
    if (!(isNew || mustRegenerate)) continue;

    // If a custom value was provided for the setting, or the setting from which the
    // current one can be generated is not available, skip the generation.
    if (copiedModel[setting] || !copiedModel[base]) continue;

    // Otherwise, if possible, generate the setting.
    copiedModel[setting] = generator(copiedModel[base]);
  }

  const newFields = copiedModel.fields || [];

  // If the model is being newly created or if new fields were provided for an existing
  // model, we would like to re-generate the list of `identifiers` and attach the system
  // fields to the model.
  if (isNew || Object.keys(newFields).length > 0) {
    if (!copiedModel.identifiers) copiedModel.identifiers = {};

    // Intelligently select a reasonable default for which field should be used as the
    // display name of the records in the model (e.g. used in lists on the dashboard).
    if (!copiedModel.identifiers.name) {
      const suitableField = Object.entries(newFields).find(
        ([fieldSlug, field]) =>
          field.type === 'string' &&
          field.required === true &&
          ['name'].includes(fieldSlug),
      );

      copiedModel.identifiers.name = suitableField?.[0] || 'id';
    }

    // Intelligently select a reasonable default for which field should be used as the
    // slug of the records in the model (e.g. used in URLs on the dashboard).
    if (!copiedModel.identifiers.slug) {
      const suitableField = Object.entries(newFields).find(
        ([fieldSlug, field]) =>
          field.type === 'string' &&
          field.unique === true &&
          field.required === true &&
          ['slug', 'handle'].includes(fieldSlug),
      );

      copiedModel.identifiers.slug = suitableField?.[0] || 'id';
    }
  }

  return copiedModel as Model;
};

/**
 * Provides default system fields for a given model.
 *
 * @param model - The model that should receive defaults.
 * @param isNew - Whether the model is being newly created.
 *
 * @returns The updated model.
 */
export const addDefaultModelFields = (model: Model, isNew: boolean): Model => {
  const copiedModel = { ...model };
  const existingFields = copiedModel.fields || [];

  // If the model is being newly created or if new fields were provided for an existing
  // model, we would like to attach the system fields to the model.
  if (isNew || Object.keys(existingFields).length > 0) {
    // Only add default fields that are not already present in the model.
    const additionalFields = Object.fromEntries(
      Object.entries(getSystemFields(copiedModel.idPrefix)).filter(([newFieldSlug]) => {
        return !Object.hasOwn(existingFields, newFieldSlug);
      }),
    );

    copiedModel.fields = { ...additionalFields, ...existingFields };
  }

  return copiedModel as Model;
};

/**
 * Provides default system presets for a given model.
 *
 * @param list - The list of all models.
 * @param model - The model for which default presets should be added.
 *
 * @returns The model with default presets added.
 */
export const addDefaultModelPresets = (list: Array<Model>, model: Model): Model => {
  const defaultPresets: Model['presets'] = {};

  // Add default presets, which people can overwrite if they want to. Presets are
  // used to provide concise ways of writing advanced queries, by allowing for defining
  // complex queries inside the model definitions and re-using them across many
  // different queries in the codebase of an application.
  for (const [fieldSlug, rest] of Object.entries(model.fields || {})) {
    const field = { slug: fieldSlug, ...rest } as ModelField;

    if (field.type === 'link' && !fieldSlug.startsWith('ronin.')) {
      const targetModel = getModelBySlug(list, field.target);

      if (field.kind === 'many') {
        const systemModel = list.find(({ system }) => {
          return system?.model === model.id && system?.associationSlug === field.slug;
        });

        if (!systemModel) continue;

        const preset: Omit<ModelPreset, 'slug'> = {
          instructions: {
            // Perform a LEFT JOIN that adds the associative table.
            including: {
              [fieldSlug]: {
                [QUERY_SYMBOLS.QUERY]: {
                  get: {
                    [systemModel.pluralSlug]: {
                      // ON associative_table.source = origin_model.id
                      with: {
                        source: {
                          [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
                        },
                      },

                      // Perform a LEFT JOIN that adds the target model table.
                      including: {
                        [QUERY_SYMBOLS.QUERY]: {
                          get: {
                            [targetModel.slug]: {
                              // ON target_model.id = associative_table.target
                              with: {
                                id: {
                                  [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}target`,
                                },
                              },
                            },
                          },
                        },
                      },

                      selecting: ['**', '!source', '!target'],
                    },
                  },
                },
              },
            },
          },
          name: slugToName(fieldSlug),
          system: true,
        };

        defaultPresets[fieldSlug] = preset;
        continue;
      }

      // For every link field, add a default preset for resolving the linked record in
      // the model that contains the link field.
      const preset: Omit<ModelPreset, 'slug'> = {
        instructions: {
          including: {
            [fieldSlug]: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  [targetModel.slug]: {
                    with: {
                      // Compare the `id` field of the related model to the link field on
                      // the root model (`field.slug`).
                      id: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}${field.slug}`,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        name: slugToName(fieldSlug),
        system: true,
      };

      defaultPresets[fieldSlug] = preset;
    }
  }

  // Find potential child models that are referencing the current parent model. For
  // each of them, we then add a default preset for resolving the child records from the
  // parent model.
  const childModels = list
    .map((subModel) => {
      // Do not assign default presets for associative models.
      if (subModel.system?.associationSlug) return null;

      const field = Object.entries(subModel.fields).find(([fieldSlug, rest]) => {
        const field = { slug: fieldSlug, ...rest } as ModelField;
        return field.type === 'link' && field.target === model.slug;
      });

      if (!field) return null;
      return { model: subModel, field: { slug: field[0], ...field[1] } };
    })
    .filter((match) => match !== null);

  for (const childMatch of childModels) {
    const { model: childModel, field: childField } = childMatch;
    const pluralSlug = childModel.pluralSlug as string;

    const presetSlug = childModel.system?.associationSlug || pluralSlug;

    const preset: Omit<ModelPreset, 'slug'> = {
      instructions: {
        including: {
          [presetSlug]: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                [pluralSlug]: {
                  with: {
                    [childField.slug]: {
                      [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
                    },
                  },
                },
              },
            },
          },
        },
      },
      name: slugToName(presetSlug),
      system: true,
    };

    defaultPresets[presetSlug] = preset;
  }

  if (Object.keys(defaultPresets).length > 0) {
    const existingPresets = model.presets;

    // Only add default presets that are not already present in the model.
    const additionalPresets = Object.fromEntries(
      Object.entries(defaultPresets).filter(([newPresetSlug]) => {
        return !existingPresets?.[newPresetSlug];
      }),
    );

    model.presets = { ...additionalPresets, ...existingPresets };
  }

  return model;
};
