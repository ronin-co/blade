import {
  WITH_CONDITIONS,
  type WithCondition,
  type WithFilters,
  type WithValue,
  type WithValueOptions,
  getMatcher,
} from '@/src/instructions/with';
import { getFieldFromModel, getModelBySlug } from '@/src/model';
import type { Model, ModelField } from '@/src/types/model';
import type {
  CombinedInstructions,
  FieldSelector,
  GetInstructions,
  Instructions,
  Query,
  QueryInstructionType,
  SetInstructions,
  Statement,
  WithInstruction,
} from '@/src/types/query';
import { QUERY_SYMBOLS, RONIN_MODEL_FIELD_REGEX } from '@/src/utils/constants';
import { CompilerError, getQuerySymbol, isObject } from '@/src/utils/helpers';
import { compileQueryInput } from '@/src/utils/index';

/**
 * Serializes individual keys and values within a JSON object and escapes query symbols.
 *
 * @param key - The key of the JSON property.
 * @param value - The value of the JSON property.
 *
 * @returns The serialized value of the JSON property.
 */
const replaceJSON = (key: string, value: string): unknown => {
  if (key === QUERY_SYMBOLS.EXPRESSION) return value.replaceAll(`'`, `''`);
  return value;
};

/**
 * Determines which of the provided model fields match a given pattern.
 *
 * @param fields - The fields of a particular model.
 * @param pattern - The pattern to match against the fields.
 *
 * @returns The fields that match the provided pattern.
 */
const matchSelectedFields = (
  fields: Array<ModelField>,
  pattern: string,
): Array<ModelField> => {
  // Step 1: Escape real dots
  let regexStr = pattern.replace(/\./g, '\\.');

  // Step 2: Temporarily replace all '**' so we don't conflict with single '*'
  regexStr = regexStr.replace(/\*\*/g, '<<DOUBLESTAR>>');

  // Step 3: Replace remaining single '*' with a pattern that cannot cross dots
  regexStr = regexStr.replace(/\*/g, '[^.]*');

  // Step 4: Replace the <<DOUBLESTAR>> placeholders with a pattern that can cross dots
  regexStr = regexStr.replace(/<<DOUBLESTAR>>/g, '.*');

  // Finally, build the full RegExp: match from start ^ to end $
  const regex = new RegExp(`^${regexStr}$`);

  return fields.filter((field) => regex.test(field.slug));
};

/**
 * Determines which fields of a model should be selected by a query, based on the value
 * of a provided `selecting` instruction.
 *
 * @param model - The model associated with the current query.
 * @param instruction - The `selecting` instruction provided in the current query.
 *
 * @returns The list of fields that should be selected.
 */
export const filterSelectedFields = (
  model: Model,
  instruction: CombinedInstructions['selecting'],
): Array<ModelField> => {
  const mappedFields = Object.entries(model.fields).map(
    ([fieldSlug, field]) => ({ slug: fieldSlug, ...field }) as ModelField,
  );
  if (!instruction) return mappedFields;

  let selectedFields: Array<ModelField> = [];

  for (const pattern of instruction) {
    const isNegative = pattern.startsWith('!');
    const cleanPattern = isNegative ? pattern.slice(1) : pattern;

    const matchedFields = matchSelectedFields(
      isNegative ? selectedFields : mappedFields,
      cleanPattern,
    );

    if (isNegative) {
      selectedFields = selectedFields.filter((field) => !matchedFields.includes(field));
    } else {
      selectedFields.push(...matchedFields);
    }
  }

  return selectedFields;
};

/**
 * Inserts a value into the list of statement values and returns a placeholder for it.
 *
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param value - The value that should be prepared for insertion.
 *
 * @returns A placeholder for the inserted value.
 */
export const prepareStatementValue = (
  statementParams: Statement['params'] | null,
  value: unknown,
): string => {
  // If no list of statement values is available, that means we should inline the value,
  // which is desired in cases where there is no risk of SQL injection and where the
  // values must be plainly visible for manual human inspection.
  const inlineParams = !statementParams;

  // We don't need to register `null` as a statement value, because it's not a value, but
  // rather a representation of the absence of a value. We can just inline it.
  if (value === null) return 'NULL';

  let formattedValue = value;

  if (Array.isArray(value) || isObject(value)) {
    formattedValue = JSON.stringify(value, inlineParams ? replaceJSON : undefined);
  } else if (typeof value === 'boolean') {
    // When binding statement values, SQLite requires booleans as integers.
    formattedValue = value ? 1 : 0;
  } else if (value instanceof Date) {
    formattedValue = value.toISOString();
  }

  if (!statementParams) {
    if (typeof formattedValue === 'string') return `'${formattedValue}'`;
    return formattedValue!.toString();
  }

  const index = statementParams.push(formattedValue as Statement['params'][number]);
  return `?${index}`;
};

/**
 * Parses a RONIN expression and returns the SQL expression.
 *
 * @param model - The specific model being addressed in the surrounding query.
 * @param instructionName - The name of the instruction that is being processed.
 * @param expression - The expression that should be parsed.
 * @param parentModel - The model of the parent query, if there is one.
 *
 * @returns An SQL expression.
 */
export const parseFieldExpression = (
  model: Model,
  instructionName: QueryInstructionType,
  expression: string,
  parentModel?: Model,
): string => {
  return expression.replace(RONIN_MODEL_FIELD_REGEX, (match) => {
    let toReplace: string = QUERY_SYMBOLS.FIELD;
    let rootModel: Model = model;

    // If a parent field is being referenced inside the value of the field, we need to
    // obtain the field from the parent model instead of the current model.
    if (match.startsWith(QUERY_SYMBOLS.FIELD_PARENT)) {
      rootModel = parentModel as Model;
      toReplace = QUERY_SYMBOLS.FIELD_PARENT;
    }

    const fieldSlug = match.replace(toReplace, '');
    const field = getFieldFromModel(rootModel, fieldSlug, { instructionName });

    return field.fieldSelector;
  });
};

/**
 * Generates an SQL condition, column name, or column value for the provided field.
 *
 * @param models - A list of models.
 * @param model - The specific model being addressed in the query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instructionName - The name of the instruction that is being processed.
 * @param value - The value that the selected field should be compared with.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL condition for the provided field. Alternatively only its column name
 * or column value.
 */
export const composeFieldValues = (
  models: Array<Model>,
  model: Model,
  statementParams: Statement['params'] | null,
  instructionName: QueryInstructionType,
  value: WithValue | Record<typeof QUERY_SYMBOLS.QUERY, Query>,
  options: {
    fieldSlug: string;
    type?: 'fields' | 'values';
    parentModel?: Model;
    condition?: WithCondition;
  },
): string => {
  const { fieldSelector: conditionSelector } = getFieldFromModel(
    model,
    options.fieldSlug,
    { instructionName },
  );

  // If only the field selectors are being requested, do not register any values.
  const collectStatementValue = options.type !== 'fields';

  // Determine if the value of the field is a symbol.
  const symbol = getQuerySymbol(value);

  let conditionMatcher = instructionName === 'to' ? '=' : getMatcher(value, false);
  let conditionValue: unknown = value;

  // Obtain the SQL syntax that should be used for the current condition.
  if (options.condition) {
    [conditionMatcher, conditionValue] = WITH_CONDITIONS[options.condition](value);
  }

  if (symbol) {
    // The value of the field is a RONIN expression, which we need to compile into an SQL
    // syntax that can be run.
    if (symbol?.type === 'expression') {
      conditionValue = parseFieldExpression(
        model,
        instructionName,
        symbol.value,
        options.parentModel,
      );
    }

    // The value of the field is a RONIN query, which we need to compile into an SQL
    // syntax that can be run.
    if (symbol.type === 'query' && collectStatementValue) {
      conditionValue = `(${
        compileQueryInput(symbol.value, models, statementParams).main.sql
      })`;
    }
  } else if (collectStatementValue) {
    conditionValue = prepareStatementValue(statementParams, conditionValue);
  }

  if (options.type === 'fields') return conditionSelector;
  if (options.type === 'values') return conditionValue as string;

  return `${conditionSelector} ${conditionMatcher} ${conditionValue}`;
};

/**
 * Generates the conditions for each of the fields asserted in a given query instruction.
 *
 * @param models - A list of models.
 * @param model - The specific model being addressed in the query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instructionName - The name of the instruction that is being processed.
 * @param value - The value that the selected field should be compared with.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL string representing the conditions for the provided query instructions.
 */
export const composeConditions = (
  models: Array<Model>,
  model: Model,
  statementParams: Statement['params'] | null,
  instructionName: QueryInstructionType,
  value:
    | WithFilters
    | WithValueOptions
    | Record<typeof QUERY_SYMBOLS.QUERY, Query>
    | FieldSelector,
  options: Omit<Parameters<typeof composeFieldValues>[5], 'fieldSlug'> & {
    fieldSlug?: string;
  },
): string => {
  const isNested = isObject(value) && Object.keys(value as object).length > 0;

  // 1. Check for conditions.
  //
  // Most commonly, the surrounding function is provided with an object. Before we can
  // continue processing any potential fields inside of this object, we would like to
  // assert whether it contains any of the known query conditions (such as `being`). If
  // it does, we want to invoke the surrounding function again, but additionally provide
  // information about which kind of condition is being performed.
  if (isNested && Object.keys(value as object).every((key) => key in WITH_CONDITIONS)) {
    const conditions = (
      Object.entries(value as object) as Array<[WithCondition, WithValueOptions]>
    ).map(([conditionType, checkValue]) =>
      composeConditions(models, model, statementParams, instructionName, checkValue, {
        ...options,
        condition: conditionType,
      }),
    );

    return conditions.join(' AND ');
  }

  // 2. Check for the existance of a field.
  //
  // If the surrounding function was provided with a `fieldSlug`, that means the value of
  // a field is being asserted, so we first have to check whether that field exists and
  // then check its type. Based on that, we then know how to treat the value of the field.
  //
  // Specifically, if the field is of the type "link" or "json", we have to treat any
  // potential object value in a special way, instead of just iterating over the nested
  // fields and trying to assert the column for each one.
  if (options.fieldSlug) {
    const childField = Object.keys(model.fields).some((slug) => {
      return slug.includes('.') && slug.split('.')[0] === options.fieldSlug;
    });

    // If a nested field exists within the model that is nested under the field slug that
    // was provided, we know that the current field is a parent field, which means it
    // exists on records as a key, but not as a real field inside the model. That means
    // we can just continue parsing its contents.
    if (!childField) {
      const fieldDetails = getFieldFromModel(model, options.fieldSlug, {
        instructionName,
      });

      const { field: modelField } = fieldDetails || {};

      // If the `to` instruction is used, JSON should be written as-is.
      const fieldIsJSON =
        (modelField?.type === 'json' || modelField?.type === 'blob') &&
        instructionName === 'to';

      // Whether the value contains valid JSON. We are purposefully not considering any
      // primitive value that could be serialized as JSON here (such as integers), since
      // those should be stored in their dedicated primitive field types.
      const valueIsJSON =
        isObject(value) || (modelField?.type === 'blob' ? null : Array.isArray(value));

      if (!valueIsJSON || getQuerySymbol(value) || fieldIsJSON) {
        if (modelField && fieldIsJSON && !valueIsJSON && value !== null) {
          const messagePrefix = 'The provided field value is not';
          const message =
            modelField.type === 'json'
              ? `${messagePrefix} valid JSON. Only objects and arrays should be provided. Other types of values should be stored in their respective primitive field types.`
              : `${messagePrefix} a valid Blob reference.`;

          throw new CompilerError({
            message,
            field: modelField?.slug,
            code: 'INVALID_FIELD_VALUE',
          });
        }

        return composeFieldValues(
          models,
          model,
          statementParams,
          instructionName,
          value as WithValue,
          { ...options, fieldSlug: options.fieldSlug as string },
        );
      }

      if (modelField?.type === 'link' && isNested) {
        // `value` is asserted to be an object using `isObject` above, so we can safely
        // cast it here. The type is not being inferred automatically.
        const keys = Object.keys(value as object);
        const values = Object.values(value as object);

        let recordTarget: WithValue | Record<typeof QUERY_SYMBOLS.QUERY, Query>;

        // If only a single key is present, and it's "id", then we can simplify the query
        // a bit in favor of performance, because the stored value of a link field in
        // SQLite is always the ID of the linked record. That means we don't need to join
        // the destination table, and we can just perform a string assertion.
        if (keys.length === 1 && keys[0] === 'id') {
          // This can be either a string or an object with conditions such as `being`.
          recordTarget = values[0];
        } else {
          const relatedModel = getModelBySlug(models, modelField.target);

          const subQuery: Query = {
            get: {
              [relatedModel.slug]: {
                with: value as WithInstruction,
                selecting: ['id'],
              },
            },
          };

          recordTarget = {
            [QUERY_SYMBOLS.QUERY]: subQuery,
          };
        }

        return composeConditions(
          models,
          model,
          statementParams,
          instructionName,
          recordTarget,
          options,
        );
      }
    }
  }

  // 3. Check for the existance of nested fields.
  //
  // If the value of the field is an object at this stage of the function, that means
  // we are dealing with an object full of nested fields, because other kinds of objects
  // (e.g. JSON objects, Reference objects, and objects containing conditions) have
  // already been matched further above.
  //
  // We can therefore iterate over all fields inside that object and invoke the
  // surrounding function again for each one, in order to handle any deeply nested fields
  // or conditions that might be available.
  if (isNested) {
    const conditions = Object.entries(value as object).map(([field, value]) => {
      const nestedFieldSlug = options.fieldSlug ? `${options.fieldSlug}.${field}` : field;

      // If the value of the field is an object or array, we have to assume it might
      // either contain a list of nested fields that must be matched, or a list of
      // conditions (such as `being`, `notBeing`) that must be matched, so we have to
      // start from the beginning again.
      return composeConditions(models, model, statementParams, instructionName, value, {
        ...options,
        fieldSlug: nestedFieldSlug,
      });
    });

    const joiner = instructionName === 'to' ? ', ' : ' AND ';

    if (instructionName === 'to') return `${conditions.join(joiner)}`;
    return conditions.length === 1
      ? conditions[0]
      : options.fieldSlug
        ? `(${conditions.join(joiner)})`
        : conditions.join(joiner);
  }

  // 4. Check for OR conditions.
  //
  // If the provided value is an array and none of the checks further above have been
  // matched, that means we're dealing with an OR condition, so each of the values inside
  // the array must be treated as a possibility inside of an OR condition.
  if (Array.isArray(value)) {
    const conditions = value.map((filter) =>
      composeConditions(models, model, statementParams, instructionName, filter, options),
    );

    return conditions.join(' OR ');
  }

  // 5. Handle empty fields.
  //
  // If the provided value could not be matched against any of the allowed value types,
  // that means the provided value is empty, which is not allowed. To inform the
  // developer, we are therefore throwing an error.
  throw new CompilerError({
    message: `The \`with\` instruction must not contain an empty field. The following fields are empty: \`${options.fieldSlug}\`. If you meant to query by an empty field, try using \`null\` instead.`,
    code: 'INVALID_WITH_VALUE',
    queries: null,
  });
};

/**
 * Finds special identifiers (Name Identifier or Slug Identifier) in the instructions of
 * a query and replaces them with their respective field slugs.
 *
 * For example, if the field `firstName` is configured as the Title Identifier in the
 * model, any use of `nameIdentifier` will be replaced with `firstName` inside the
 * query instructions.
 *
 * @param model - The model being addressed in the query.
 * @param queryInstructions - The instructions of the query that is being run.
 *
 * @returns The provided query instructions, with special identifiers replaced.
 */
export const formatIdentifiers = (
  { identifiers }: Model,
  queryInstructions: Instructions | undefined,
): (Instructions & SetInstructions) | undefined => {
  // Queries might not have instructions (such as `get.accounts`).
  if (!queryInstructions) return queryInstructions;

  const type = 'with' in queryInstructions ? 'with' : null;

  // Special identifiers may only be used in the `with` instructions, so we
  // want to skip all others.
  if (!type) return queryInstructions as Instructions & SetInstructions;

  // We currently also don't need to support special identifiers inside arrays.
  const nestedInstructions = (queryInstructions as GetInstructions)[type];
  if (!nestedInstructions || Array.isArray(nestedInstructions))
    return queryInstructions as Instructions & SetInstructions;

  const newNestedInstructions = { ...nestedInstructions };

  for (const oldKey of Object.keys(newNestedInstructions)) {
    if (oldKey !== 'nameIdentifier' && oldKey !== 'slugIdentifier') continue;

    const identifierName = oldKey === 'nameIdentifier' ? 'name' : 'slug';
    const value = newNestedInstructions[oldKey];
    const newKey = identifiers[identifierName];

    newNestedInstructions[newKey] = value;
    delete newNestedInstructions[oldKey];
  }

  return {
    ...queryInstructions,
    [type]: newNestedInstructions,
  } as Instructions & SetInstructions;
};
