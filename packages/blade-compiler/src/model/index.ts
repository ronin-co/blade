import { handleWith } from '@/src/instructions/with';
import {
  addDefaultModelAttributes,
  addDefaultModelFields,
  addDefaultModelPresets,
  slugToName,
} from '@/src/model/defaults';
import type {
  Model,
  ModelEntity,
  ModelEntityList,
  ModelField,
  ModelFieldLinkAction,
  ModelIndex,
  PartialModel,
  PublicModel,
} from '@/src/types/model';
import type {
  InternalDependencyStatement,
  ModelEntityType,
  ModelQueryType,
  Query,
  QueryInstructionType,
  Statement,
} from '@/src/types/query';
import {
  CURRENT_TIME_EXPRESSION,
  type DDL_QUERY_TYPES,
  QUERY_SYMBOLS,
} from '@/src/utils/constants';
import {
  CompilerError,
  MODEL_ENTITY_ERROR_CODES,
  convertToCamelCase,
  convertToSnakeCase,
  getQuerySymbol,
  isObject,
  splitQuery,
} from '@/src/utils/helpers';
import { compileQueryInput } from '@/src/utils/index';
import { parseFieldExpression, prepareStatementValue } from '@/src/utils/statement';

/**
 * Finds a model by its slug or plural slug.
 *
 * @param models - A list of models.
 * @param slug - The slug to search for.
 *
 * @returns A model for the provided slug or plural slug.
 */
export const getModelBySlug = <T extends Model | PublicModel>(
  models: Array<T>,
  slug: string,
): T => {
  const model = models.find((model) => {
    return model.slug === slug || model.pluralSlug === slug;
  });

  if (!model) {
    throw new CompilerError({
      message: `No matching model with either Slug or Plural Slug of "${slug}" could be found.`,
      code: 'MODEL_NOT_FOUND',
    });
  }

  return model;
};

/**
 * Composes the slug of an associative model that is used to establish a relationship
 * between two models that are not directly related to each other.
 *
 * @param model - The model that contains the link field.
 * @param field - The link field that is being used to establish the relationship.
 *
 * @returns A slug for the associative model.
 */
export const composeAssociationModelSlug = (
  model: PublicModel,
  field: ModelField,
): string => convertToCamelCase(`ronin_link_${model.slug}_${field.slug}`);

/**
 * Constructs the SQL selector for a given field in a model.
 *
 * @param model - The model to which the field belongs.
 * @param field - A field from the model.
 * @param fieldPath - The path of the field being addressed. Supports dot notation for
 * accessing nested fields.
 * @param writing - Whether values are being inserted.
 *
 * @returns The SQL column selector for the provided field.
 */
const getFieldSelector = (
  model: Model,
  field: ModelField,
  fieldPath: string,
  writing: boolean,
): string => {
  const symbol = model.tableAlias?.startsWith(QUERY_SYMBOLS.FIELD_PARENT)
    ? `${model.tableAlias.replace(QUERY_SYMBOLS.FIELD_PARENT, '').slice(0, -1)}.`
    : '';
  const tablePrefix = symbol || (model.tableAlias ? `"${model.tableAlias}".` : '');

  // If the field is of type JSON and the field is being selected in a read query, that
  // means we should extract the nested property from the JSON field.
  if (
    (field.type === 'json' || field.type === 'blob') &&
    !writing &&
    fieldPath.length > field.slug.length
  ) {
    const jsonField = fieldPath.replace(`${field.slug}.`, '');
    return `json_extract(${tablePrefix + field.slug}, '$.${jsonField}')`;
  }

  return `${tablePrefix}"${fieldPath}"`;
};

/**
 * The details of a query instruction or model entity that is requesting a particular
 * field to be loaded.
 */
type ModelFieldSource =
  | {
      instructionName: QueryInstructionType;
    }
  | {
      modelEntityName: string;
      modelEntityType: ModelEntityType;
    };

export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  source: ModelFieldSource,
  shouldThrow?: true,
): { field: ModelField; fieldSelector: string };

export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  source: ModelFieldSource,
  shouldThrow?: false,
): { field: ModelField; fieldSelector: string } | null;

export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  source: ModelFieldSource,
  shouldThrow: boolean,
): { field: ModelField; fieldSelector: string } | null;

/**
 * Obtains a field from a given model using its path.
 *
 * @param model - The model to retrieve the field from.
 * @param fieldPath - The path of the field to retrieve. Supports dot notation for
 * accessing nested fields.
 * @param source - The details of the instruction or entity that requests the field.
 * @param shouldThrow - Whether to throw an error if the field is not found.
 *
 * @returns The requested field of the model, and its SQL selector.
 */
export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  source: ModelFieldSource,
  shouldThrow = true,
): { field: ModelField; fieldSelector: string } | null {
  const writingField =
    'instructionName' in source ? source.instructionName === 'to' : true;
  const errorTarget =
    'instructionName' in source
      ? `\`${source.instructionName}\``
      : `${source.modelEntityType} "${source.modelEntityName}"`;

  const errorPrefix = `Field "${fieldPath}" defined for ${errorTarget}`;
  const modelFields = Object.entries(model.fields).map(
    ([fieldSlug, field]) =>
      ({
        slug: fieldSlug,
        ...field,
      }) as ModelField,
  );

  let modelField: ModelField | undefined;

  // If the field being accessed is actually a nested property of a JSON field, return
  // that root JSON field.
  if (fieldPath.includes('.')) {
    modelField = modelFields.find((field) => field.slug === fieldPath.split('.')[0]);

    if (modelField?.type === 'json' || modelField?.type === 'blob') {
      const fieldSelector = getFieldSelector(model, modelField, fieldPath, writingField);
      return { field: modelField, fieldSelector };
    }
  }

  modelField = modelFields.find((field) => field.slug === fieldPath);

  if (!modelField) {
    if (shouldThrow) {
      throw new CompilerError({
        message: `${errorPrefix} does not exist in model "${model.name}".`,
        code: 'FIELD_NOT_FOUND',
        field: fieldPath,
        queries: null,
      });
    }

    return null;
  }

  const fieldSelector = getFieldSelector(model, modelField, fieldPath, writingField);
  return { field: modelField, fieldSelector };
}

/** These fields are required by the system and automatically added to every model. */
export const getSystemFields = (idPrefix: Model['idPrefix']): Model['fields'] => ({
  id: {
    name: 'ID',
    type: 'string',
    defaultValue: {
      // Since default values in SQLite cannot rely on other columns, we unfortunately
      // cannot rely on the `idPrefix` column here. Instead, we need to inject it
      // directly into the expression as a static string.
      [QUERY_SYMBOLS.EXPRESSION]: `'${idPrefix}_' || lower(substr(hex(randomblob(12)), 1, 16))`,
    },
    system: true,
  },
  'ronin.createdAt': {
    name: 'RONIN - Created At',
    type: 'date',
    defaultValue: CURRENT_TIME_EXPRESSION,
    system: true,
  },
  'ronin.createdBy': {
    name: 'RONIN - Created By',
    type: 'string',
    system: true,
  },
  'ronin.updatedAt': {
    name: 'RONIN - Updated At',
    type: 'date',
    defaultValue: CURRENT_TIME_EXPRESSION,
    system: true,
  },
  'ronin.updatedBy': {
    name: 'RONIN - Updated By',
    type: 'string',
    system: true,
  },
});

/**
 * This model defines the architecture of the `ronin_schema` table, which is RONIN's
 * equivalent to the native `sqlite_schema` table provided by SQLite.
 */
export const ROOT_MODEL: PartialModel = {
  // Provide the ID ahead of time, because certain runtime environments (e.g. Cloudflare
  // Workers) do not support the `crypto` module running in global scope, which would
  // happen when generating the default attributes of the root model.
  id: 'mod_26cedf5fc602c3ba',

  // While the `slug` is required, we are providing the other attributes in order to
  // avoid needing to generate them at runtime.
  slug: 'roninModel',
  pluralSlug: 'roninModels',
  name: 'Ronin Model',
  pluralName: 'Ronin Models',

  identifiers: {
    name: 'name',
    slug: 'slug',
  },

  // The default ID prefix would be `ron_` based on the slug, but we want `mod_`.
  idPrefix: 'mod',

  // This name mimics the `sqlite_schema` table in SQLite.
  table: 'ronin_schema',

  // Indicates that the model was automatically generated by RONIN.
  system: { model: 'root' },

  fields: {
    name: { type: 'string' },
    pluralName: { type: 'string' },
    slug: { type: 'string' },
    pluralSlug: { type: 'string' },

    idPrefix: { type: 'string' },
    table: { type: 'string' },

    'identifiers.name': { type: 'string' },
    'identifiers.slug': { type: 'string' },

    // Providing an empty object as a default value allows us to use `json_insert`
    // without needing to fall back to an empty object in the insertion statement,
    // which makes the statement shorter.
    fields: { type: 'json', defaultValue: {} },
    indexes: { type: 'json', defaultValue: {} },
    presets: { type: 'json', defaultValue: {} },
  },
};

/**
 * We're adding the attributes of the root model at bootup time, so that the performance
 * of the query compilation is not affected.
 */
export const ROOT_MODEL_WITH_ATTRIBUTES = addDefaultModelAttributes(ROOT_MODEL, true);

/**
 * Composes a list of potential system models that might be required for a manually
 * provided model.
 *
 * @param list - The list of all models.
 * @param model - The model for which system models should be generated.
 *
 * @returns The list of system models.
 */
export const getSystemModels = (models: Array<Model>, model: Model): Array<Model> => {
  const addedModels: Array<PartialModel> = [];

  for (const [fieldSlug, rest] of Object.entries(model.fields || {})) {
    const field = { slug: fieldSlug, ...rest } as ModelField;

    if (field.type === 'link' && !fieldSlug.startsWith('ronin.')) {
      const relatedModel = getModelBySlug(models, field.target);

      let fieldSlug = relatedModel.slug;

      // If a link field with the cardinality "many" is found, we would like to
      // initialize an invisible associative model, which is used to establish the
      // relationship between the source model and target model, even though those two
      // are not directly related to each other.
      if (field.kind === 'many') {
        fieldSlug = composeAssociationModelSlug(model, field);

        addedModels.push({
          pluralSlug: fieldSlug,
          slug: fieldSlug,
          system: {
            model: model.id,
            associationSlug: field.slug,
          },
          fields: {
            source: {
              type: 'link',
              target: model.slug,
              actions: {
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
              },
            },
            target: {
              type: 'link',
              target: relatedModel.slug,
              actions: {
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
              },
            },
          },
        });
      }
    }
  }

  return addedModels.map((model) => addDefaultModelAttributes(model, true));
};

/** A list of all RONIN data types and their respective column types in SQLite. */
const typesInSQLite = {
  link: 'TEXT',
  string: 'TEXT',
  date: 'DATETIME',
  blob: 'TEXT',
  boolean: 'BOOLEAN',
  number: 'INTEGER',
  json: 'TEXT',
};

/**
 * Composes the SQL syntax for a field in a RONIN model.
 *
 * @param models - A list of models.
 * @param model - The model that contains the field.
 * @param field - The field of a RONIN model.
 *
 * @returns The SQL syntax for the provided field, or `null` if none should be generated.
 */
const getFieldStatement = (
  models: Array<Model>,
  model: Model,
  field: ModelField,
): string | null => {
  let statement = `"${field.slug}" ${typesInSQLite[field.type || 'string']}`;

  if (field.slug === 'id') statement += ' PRIMARY KEY';
  if (field.unique === true) statement += ' UNIQUE';
  if (field.required === true) statement += ' NOT NULL';

  if (typeof field.defaultValue !== 'undefined') {
    const symbol = getQuerySymbol(field.defaultValue);

    let value =
      typeof field.defaultValue === 'string'
        ? `'${field.defaultValue}'`
        : field.defaultValue;
    if (symbol) value = `(${parseFieldExpression(model, 'to', symbol.value as string)})`;
    if (field.type === 'json') {
      if (!isObject(field.defaultValue)) {
        throw new CompilerError({
          message: `The default value of JSON field "${field.slug}" must be an object.`,
          code: 'INVALID_MODEL_VALUE',
          field: 'fields',
        });
      }

      value = `'${JSON.stringify(field.defaultValue)}'`;
    }

    statement += ` DEFAULT ${value}`;
  }

  if (field.type === 'string' && field.collation) {
    statement += ` COLLATE ${field.collation}`;
  }

  if (field.type === 'number' && field.increment === true) {
    statement += ' AUTOINCREMENT';
  }

  if (typeof field.check !== 'undefined') {
    const symbol = getQuerySymbol(field.check);
    statement += ` CHECK (${parseFieldExpression(model, 'to', symbol?.value as string)})`;
  }

  if (typeof field.computedAs !== 'undefined') {
    const { kind, value } = field.computedAs;
    const symbol = getQuerySymbol(value);
    statement += ` GENERATED ALWAYS AS (${parseFieldExpression(model, 'to', symbol?.value as string)}) ${kind}`;
  }

  if (field.type === 'link') {
    // Link fields with the cardinality "many" do not exist as columns in the database.
    // Instead, they are added in the output transformation of the compiler.
    if (field.kind === 'many') return null;

    const actions = field.actions || {};

    // Passing the current model here is imporant, because it allows for creating a model
    // that references itself.
    const modelList = models.some((item) => item.slug === model.slug)
      ? models
      : [...models, model];
    const targetTable = getModelBySlug(modelList, field.target).table;

    statement += ` REFERENCES ${targetTable}("id")`;

    for (const cause in actions) {
      if (!Object.hasOwn(actions, cause)) continue;

      const causeName = cause.toUpperCase().slice(2);
      const action = actions[cause as keyof typeof actions] as ModelFieldLinkAction;

      statement += ` ON ${causeName} ${action}`;
    }
  }

  return statement;
};

// Keeping these hardcoded instead of using `pluralize` is faster.
const PLURAL_MODEL_ENTITIES = {
  field: 'fields',
  index: 'indexes',
  preset: 'presets',
} as const;

export const PLURAL_MODEL_ENTITIES_VALUES = Object.values(PLURAL_MODEL_ENTITIES);

/**
 * Composes an SQL statement for creating, altering, or dropping a system model.
 *
 * @param models - A list of models.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param action - Whether the system model should be created, altered, or dropped.
 * @param systemModel - The affected system model.
 *
 * @returns Nothing. The `models` and `dependencyStatements` arrays are modified in place.
 */
const handleSystemModel = (
  models: Array<Model>,
  dependencyStatements: Array<InternalDependencyStatement>,
  action: (typeof DDL_QUERY_TYPES)[number],
  inlineDefaults: boolean,
  systemModel: PartialModel,
  newModel?: PartialModel,
): void => {
  // Omit the `system` property.
  const { system: _, ...systemModelClean } = systemModel;

  const query: Query = {
    [action]: { model: action === 'create' ? systemModelClean : systemModelClean.slug },
  };

  if (action === 'alter' && newModel && 'alter' in query && query.alter) {
    const { system: _, ...newModelClean } = newModel;
    query.alter.to = newModelClean;
  }

  const statement = compileQueryInput(query, models, [], { inlineDefaults });

  dependencyStatements.push(...statement.dependencies);
};

/**
 * Compares the old and new attributes of a model to determine whether any system models
 * should be created, removed, or updated.
 *
 * @param models - A list of models.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param previousModel - The current model, before a change was applied.
 * @param newModel - The current model, after a change was applied.
 *
 * @returns Nothing. The `models` and `dependencyStatements` arrays are modified in place.
 */
const handleSystemModels = (
  models: Array<Model>,
  dependencyStatements: Array<InternalDependencyStatement>,
  previousModel: Model,
  newModel: Model,
  inlineDefaults: boolean,
): void => {
  const currentSystemModels = models.filter(({ system }) => {
    return system?.model === newModel.id;
  });

  const newSystemModels = getSystemModels(models, newModel);

  /**
   * Determines whether a system model should continue to exist, or not.
   *
   * @param oldSystemModel - The old system model that currently already exists.
   * @param newSystemModel - A new system model to compare it against.
   *
   * @returns Whether the system model should continue to exist.
   */
  const matchSystemModels = (
    oldSystemModel: PartialModel,
    newSystemModel: PartialModel,
  ): boolean => {
    const conditions: Array<boolean> = [
      oldSystemModel.system?.model === newSystemModel.system?.model,
    ];

    // If an old system model is acting as an associative model between two
    // manually-defined models, we need to check whether the new system model is used for
    // the same model field.
    if (oldSystemModel.system?.associationSlug) {
      const oldFieldIndex = Object.keys(previousModel.fields).findIndex((slug) => {
        return slug === (newSystemModel.system?.associationSlug as string);
      });

      const newFieldIndex = Object.keys(newModel.fields).findIndex((slug) => {
        return slug === (oldSystemModel.system?.associationSlug as string);
      });

      conditions.push(oldFieldIndex === newFieldIndex);
    }

    return conditions.every((condition) => condition === true);
  };

  // Remove any system models that are no longer required.
  for (const systemModel of currentSystemModels) {
    // Check if there are any system models that should continue to exist.
    const exists = newSystemModels.find(matchSystemModels.bind(null, systemModel));

    if (exists) {
      // Determine if the slug of the system model has changed. If so, alter the
      // respective table.
      if (exists.slug !== systemModel.slug) {
        handleSystemModel(
          models,
          dependencyStatements,
          'alter',
          inlineDefaults,
          systemModel,
          exists,
        );
      }
      continue;
    }

    handleSystemModel(models, dependencyStatements, 'drop', inlineDefaults, systemModel);
  }

  // Add any new system models that don't yet exist.
  for (const systemModel of newSystemModels) {
    // Check if there are any system models that already exist.
    const exists = currentSystemModels.find(matchSystemModels.bind(null, systemModel));
    if (exists) continue;

    handleSystemModel(
      models,
      dependencyStatements,
      'create',
      inlineDefaults,
      systemModel,
    );
  }
};

/**
 * Handles queries that modify the DB schema. Specifically, those are `create.model`,
 * `alter.model`, and `drop.model` queries.
 *
 * @param models - A list of models.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param query - The query that should potentially be transformed.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns The transformed query or `null` if no further query processing should happen.
 */
export const transformMetaQuery = (
  models: Array<Model>,
  dependencyStatements: Array<InternalDependencyStatement>,
  statementParams: Statement['params'] | null,
  query: Query,
  options: {
    /**
     * Whether to compute default field values as part of the generated statement.
     */
    inlineDefaults: boolean;
  },
): Query | null => {
  const { queryType } = splitQuery(query);
  const subAltering = 'alter' in query && query.alter && !('to' in query.alter);

  const action =
    subAltering && query.alter
      ? (Object.keys(query.alter).filter((key) => key !== 'model')[0] as ModelQueryType)
      : (queryType as ModelQueryType);

  const actionReadable =
    action === 'create' ? 'creating' : action === 'alter' ? 'altering' : 'dropping';

  const entity = (
    subAltering && query.alter
      ? Object.keys((query.alter as unknown as Record<ModelQueryType, string>)[action])[0]
      : 'model'
  ) as ModelEntityType | 'model';

  let slug =
    entity === 'model' && action === 'create'
      ? null
      : query[queryType] && 'model' in query[queryType]
        ? (query[queryType].model as string)
        : null;
  let modelSlug = slug;

  let jsonValue: Record<string, unknown> | undefined;

  if ('list' in query && query.list) {
    if (slug) {
      return { get: { roninModel: { with: { slug } } } };
    }

    return { get: { roninModels: {} } };
  }

  if ('create' in query && query.create) {
    const init = query.create.model;
    jsonValue =
      'to' in query.create
        ? ({ slug: init, ...query.create.to } as PartialModel)
        : (init as PartialModel);

    slug = modelSlug = jsonValue.slug as string;
  }

  if ('alter' in query && query.alter) {
    if ('to' in query.alter) {
      jsonValue = query.alter.to;
    } else {
      slug = (
        query.alter as unknown as Record<ModelQueryType, Record<ModelEntityType, string>>
      )[action][entity as ModelEntityType];

      if ('create' in query.alter) {
        const item = (
          query.alter.create as unknown as Record<ModelEntityType, ModelIndex>
        )[entity as ModelEntityType] as Partial<ModelIndex>;

        slug = item.slug as string;
        jsonValue = { slug, ...item };
      }

      if ('alter' in query.alter && query.alter.alter) jsonValue = query.alter.alter.to;
    }
  }

  if (!(modelSlug && slug)) return query;

  const model =
    action === 'create' && entity === 'model' ? null : getModelBySlug(models, modelSlug);

  if (entity === 'model') {
    let queryTypeDetails: { to?: PartialModel } | { with?: PartialModel } = {};

    if (action === 'create') {
      const newModel = jsonValue as unknown as Model;

      // Compose default settings for the model.
      const modelWithAttributes = addDefaultModelAttributes(newModel, true);
      const modelWithFields = addDefaultModelFields(modelWithAttributes, true);
      const modelWithPresets = addDefaultModelPresets(
        [...models, modelWithFields],
        modelWithFields,
      );

      // Replace the entire array to avoid modifying the objects inside the arrays, which
      // would cause the model object passed to the compiler to also be modified, since
      // objects are passed around by reference in JS.
      modelWithPresets.fields = Object.fromEntries(
        Object.entries(modelWithPresets.fields).map(([fieldSlug, rest]) => [
          fieldSlug,
          {
            ...rest,
            // Default field type.
            type: rest.type || 'string',
            // Default field name.
            name: rest.name || slugToName(fieldSlug),
          },
        ]),
      ) as ModelEntityList<ModelField>;

      const columns = Object.entries(modelWithPresets.fields)
        .map(([fieldSlug, rest]) =>
          getFieldStatement(models, modelWithPresets, {
            slug: fieldSlug,
            ...rest,
          } as ModelField),
        )
        .filter(Boolean);

      // Add the newly created model to the list of models.
      models.push(modelWithPresets);

      // Compose the SQL statement for creating the table.
      dependencyStatements.push({
        sql: `CREATE TABLE "${modelWithPresets.table}" (${columns.join(', ')})`,
        params: [],
      });

      const entityList = modelWithPresets.indexes;

      // Compose the SQL statements for creating indexes.
      for (const [itemSlug, item] of Object.entries(entityList || {})) {
        const query: Query = {
          alter: {
            model: modelWithPresets.slug,
            create: {
              index: { slug: itemSlug, ...item },
            },
          },
        };

        // Create a temporary list of models on which `transformMetaQuery` will operate,
        // which ensures that `modelWithPresets` is not modified in place.
        const tempModels: Array<Model> = [
          ...models.filter((model) => model.slug !== modelWithPresets.slug),
          { ...modelWithPresets, indexes: {} } as Model,
        ];

        // The `dependencyStatements` array is modified in place.
        transformMetaQuery(tempModels, dependencyStatements, null, query, {
          inlineDefaults: options.inlineDefaults,
        });
      }

      queryTypeDetails = { with: modelWithPresets };

      // Add any system models that might be needed by the model.
      getSystemModels(models, modelWithPresets).map((systemModel) => {
        // Compose the SQL statement for adding the system model.
        // This modifies the original `models` array and adds the system model to it.
        return handleSystemModel(
          models,
          dependencyStatements,
          'create',
          options.inlineDefaults,
          systemModel,
        );
      });
    }

    if (action === 'alter' && model) {
      const modelBeforeUpdate = structuredClone(model);
      const newModel = jsonValue as unknown as Model;

      // Compose default settings for the model.
      const modelWithAttributes = addDefaultModelAttributes(newModel, false);
      const modelWithFields = addDefaultModelFields(modelWithAttributes, false);
      const modelWithPresets = addDefaultModelPresets(models, modelWithFields);

      const newTableName = modelWithPresets.table;

      // Only push the statement if the table name changed, otherwise we don't need it.
      if (newTableName) {
        dependencyStatements.push({
          sql: `ALTER TABLE "${model.table}" RENAME TO "${newTableName}"`,
          params: [],
        });
      }

      // Update the existing model in the list of models.
      Object.assign(model, modelWithPresets);

      queryTypeDetails = {
        with: {
          slug,
        },
        to: modelWithPresets,
      };

      handleSystemModels(
        models,
        dependencyStatements,
        modelBeforeUpdate,
        model,
        options.inlineDefaults,
      );
    }

    if (action === 'drop' && model) {
      // Remove the model from the list of models.
      models.splice(models.indexOf(model), 1);

      dependencyStatements.push({ sql: `DROP TABLE "${model.table}"`, params: [] });

      queryTypeDetails = { with: { slug } };

      // Remove all system models that are associated with the model.
      models
        .filter(({ system }) => system?.model === model.id)
        .map((systemModel) => {
          // Compose the SQL statement for removing the system model.
          // This modifies the original `models` array and removes the system model from it.
          return handleSystemModel(
            models,
            dependencyStatements,
            'drop',
            options.inlineDefaults,
            systemModel,
          );
        });
    }

    const modelSlug =
      'to' in queryTypeDetails
        ? queryTypeDetails?.to?.slug
        : 'with' in queryTypeDetails
          ? queryTypeDetails?.with?.slug
          : undefined;

    // If the root model is being created or dropped, altering the `ronin_schema` table
    // is not necessary, since that table is created precisely for that model.
    if (modelSlug === 'roninModel') return null;

    const queryTypeAction =
      action === 'create' ? 'add' : action === 'alter' ? 'set' : 'remove';

    return {
      [queryTypeAction]: {
        roninModel: queryTypeDetails,
      },
    };
  }

  // Entities can only be created, altered, or dropped on existing models, so the model
  // is guaranteed to exist.
  const modelBeforeUpdate = structuredClone(model as Model);
  const existingModel = model as Model;

  const pluralType = PLURAL_MODEL_ENTITIES[entity];

  const existingEntity = existingModel[pluralType]?.[slug];

  // Throw an error if the entity that was targeted is not available in the model.
  if ((action === 'alter' || action === 'drop') && !existingEntity) {
    throw new CompilerError({
      message: `No ${entity} with slug "${slug}" defined in model "${existingModel.name}".`,
      code: MODEL_ENTITY_ERROR_CODES[entity],
    });
  }

  if (action === 'create' && existingEntity) {
    throw new CompilerError({
      message: `A ${entity} with the slug "${slug}" already exists.`,
      code: 'EXISTING_MODEL_ENTITY',
      fields: ['slug'],
    });
  }

  if (entity === 'field') {
    const statement = `ALTER TABLE "${existingModel.table}"`;

    // If the field is of type "link" and the cardinality is "many", that means it does
    // not exist as a column in the database, so we don't need to generate statements for
    // modifying that respective column. The field is handled in the compiler instead.
    const existingField = existingEntity as ModelField | undefined;
    const existingLinkField =
      existingField?.type === 'link' && existingField.kind === 'many';

    if (action === 'create') {
      const field = jsonValue as ModelField;

      // Default field type.
      field.type = field.type || 'string';

      // Default field name.
      field.name = field.name || slugToName(field.slug);

      const fieldStatement = getFieldStatement(models, existingModel, field);

      if (fieldStatement) {
        dependencyStatements.push({
          sql: `${statement} ADD COLUMN ${fieldStatement}`,
          params: [],
        });
      }
    } else if (action === 'alter') {
      const field = jsonValue as ModelField;
      const newSlug = field.slug;

      if (newSlug) {
        // Default field name.
        field.name = field.name || slugToName(field.slug);

        // Only push the statement if the column name is changing, otherwise we don't
        // need it.
        if (!existingLinkField) {
          dependencyStatements.push({
            sql: `${statement} RENAME COLUMN "${slug}" TO "${newSlug}"`,
            params: [],
          });
        }
      }
    } else if (action === 'drop' && !existingLinkField) {
      const systemFields = getSystemFields(existingModel.idPrefix);
      const isSystemField = slug in systemFields;

      if (isSystemField) {
        throw new CompilerError({
          message: `The ${entity} "${slug}" is a system ${entity} and cannot be removed.`,
          code: 'REQUIRED_MODEL_ENTITY',
        });
      }

      dependencyStatements.push({
        sql: `${statement} DROP COLUMN "${slug}"`,
        params: [],
      });
    }
  }

  const statementAction = action.toUpperCase();

  if (entity === 'index') {
    const index = jsonValue as ModelIndex;
    const indexName = convertToSnakeCase(slug);

    let statement = `${statementAction}${index?.unique ? ' UNIQUE' : ''} INDEX "${indexName}"`;

    if (action === 'create') {
      if (!Array.isArray(index.fields) || index.fields.length === 0) {
        throw new CompilerError({
          message: `When ${actionReadable} ${PLURAL_MODEL_ENTITIES[entity]}, at least one field must be provided.`,
          code: 'INVALID_MODEL_VALUE',
          field: PLURAL_MODEL_ENTITIES[entity],
        });
      }

      const columns = index.fields.map((field) => {
        let fieldSelector = '';

        // If the slug of a field is provided, find the field in the model, obtain its
        // column selector, and place it in the SQL statement.
        if ('slug' in field) {
          ({ fieldSelector } = getFieldFromModel(existingModel, field.slug, {
            modelEntityType: 'index',
            modelEntityName: indexName,
          }));
        }
        // Alternatively, if an expression is provided instead of the slug of a field,
        // find all fields inside the expression, obtain their column selectors, and
        // insert them into the expression, after which the expression can be used in the
        // SQL statement.
        else if ('expression' in field) {
          fieldSelector = parseFieldExpression(existingModel, 'to', field.expression);
        }

        if (field.collation) fieldSelector += ` COLLATE ${field.collation}`;
        if (field.order) fieldSelector += ` ${field.order}`;

        return fieldSelector;
      });

      statement += ` ON "${existingModel.table}" (${columns.join(', ')})`;

      // If filtering instructions were defined, add them to the index. Those
      // instructions will determine which records are included as part of the index.
      if (index.filter) {
        const withStatement = handleWith(models, existingModel, null, index.filter);
        statement += ` WHERE (${withStatement})`;
      }
    }

    dependencyStatements.push({ sql: statement, params: [] });
  }

  const field = `${QUERY_SYMBOLS.FIELD}${pluralType}`;

  let json: string | undefined;

  switch (action) {
    case 'create': {
      const { slug, ...entityValue } = jsonValue as ModelEntity;
      const value = prepareStatementValue(statementParams, entityValue);

      json = `json_insert(${field}, '$.${slug}', json(${value}))`;

      // Add the newly created entity to the model.
      if (!existingModel[pluralType]) existingModel[pluralType] = {};
      (existingModel[pluralType] as ModelEntityList<ModelEntity>)[slug] =
        entityValue as ModelEntity;

      break;
    }
    case 'alter': {
      // Update the existing entity in the model.
      const targetEntities = existingModel[pluralType] as ModelEntityList<ModelEntity>;

      // If the slug of a model entity has changed, we need to remove the property with
      // the name of the old slug and insert a new one with the new slug.
      if (jsonValue?.slug && jsonValue.slug !== slug) {
        const { slug: newSlug, ...entityValue } = jsonValue as ModelEntity;

        // Change the name of the property inside the object. Doing it like this instead
        // of adding a new property and removing the old one ensures that the property
        // order is preserved.
        //
        // This is important, because `handleSystemModels` relies on the order of fields
        // in order to know whether an existing field has changed, since it cannot rely
        // on the attributes of fields, because all of them might change.
        Object.defineProperty(
          targetEntities,
          newSlug,
          Object.getOwnPropertyDescriptor(targetEntities, slug)!,
        );

        // Assign the newly generated attributes to the new entity.
        Object.assign(targetEntities[newSlug], entityValue);

        // Remove the old entity.
        delete targetEntities[slug];

        const value = prepareStatementValue(statementParams, targetEntities[newSlug]);
        json = `json_insert(json_remove(${field}, '$.${slug}'), '$.${newSlug}', json(${value}))`;
      }
      // Otherwise, just update the existing property.
      else {
        Object.assign(targetEntities[slug], jsonValue);

        const value = prepareStatementValue(statementParams, jsonValue);

        // We're not using a wrapping `json()` function for the JSON value here, since
        // the `json_patch` function already automatically parses its arguments as JSON,
        // so an extra wrapping `json()` function would be unnecessary.
        json = `json_set(${field}, '$.${slug}', json_patch(json_extract(${field}, '$.${slug}'), ${value}))`;
      }

      break;
    }
    case 'drop': {
      json = `json_remove(${field}, '$.${slug}')`;

      // Remove the existing entity from the model.
      const targetEntities = existingModel[pluralType] as ModelEntityList<ModelEntity>;
      delete targetEntities[slug];
    }
  }

  handleSystemModels(
    models,
    dependencyStatements,
    modelBeforeUpdate,
    existingModel,
    options.inlineDefaults,
  );

  return {
    set: {
      roninModel: {
        with: { slug: modelSlug },
        to: {
          [pluralType]: { [QUERY_SYMBOLS.EXPRESSION]: json },
        },
      },
    },
  };
};
