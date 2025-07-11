import {
  composeAssociationModelSlug,
  getFieldFromModel,
  getModelBySlug,
} from '@/src/model';
import { getRecordIdentifier } from '@/src/model/defaults';
import type { Model } from '@/src/types/model';
import type {
  FieldValue,
  InternalDependencyStatement,
  SetInstructions,
} from '@/src/types/query';
import { CURRENT_TIME_EXPRESSION } from '@/src/utils/constants';
import { flatten, getQuerySymbol, isObject, splitQuery } from '@/src/utils/helpers';
import { compileQueryInput } from '@/src/utils/index';
import { composeConditions, filterSelectedFields } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `to` query instruction, which allows for providing
 * values that should be stored in the records that are being addressed.
 *
 * @param models - A list of models.
 * @param model - The model associated with the current query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param queryType - The type of query that is being executed.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param instructions - The `to` and `with` instruction included in the query.
 * @param options - Additional options to adjust the behavior of the statement generation.
 *
 * @returns The SQL syntax for the provided `to` instruction.
 */
export const handleTo = (
  models: Array<Model>,
  model: Model,
  statementParams: Array<unknown> | null,
  queryType: 'add' | 'set',
  dependencyStatements: Array<InternalDependencyStatement>,
  instructions: {
    with: NonNullable<SetInstructions['with']> | undefined;
    to: NonNullable<SetInstructions['to']>;
  },
  options?: Parameters<typeof compileQueryInput>[3],
): string => {
  const { with: withInstruction, to: toInstruction } = instructions;
  const defaultFields: Record<string, unknown> = {};
  const currentTime = new Date().toISOString();

  // If records are being created, assign a default ID to them, unless a custom ID was
  // already provided in the query.
  if (queryType === 'add' && options?.inlineDefaults) {
    defaultFields.id = toInstruction.id || getRecordIdentifier(model.idPrefix);
  }

  if (queryType === 'add' || queryType === 'set' || toInstruction.ronin) {
    const defaults = options?.inlineDefaults
      ? {
          // If records are being created, set their creation time.
          ...(queryType === 'add' && { createdAt: currentTime }),
          // If records are being updated or created, bump their update time.
          updatedAt: currentTime,
          // Allow for overwriting the default values provided above.
          ...(toInstruction.ronin as object),
        }
      : {
          // If records are being updated, bump their update time.
          // The creation time is already set using a default value in the DB.
          ...(queryType === 'set' ? { updatedAt: CURRENT_TIME_EXPRESSION } : {}),
          // Allow for overwriting the default values provided above.
          ...(toInstruction.ronin as object),
        };

    if (Object.keys(defaults).length > 0) defaultFields.ronin = defaults;
  }

  // Check whether a query resides at the root of the `to` instruction.
  const symbol = getQuerySymbol(toInstruction);

  // If a sub query is provided as the `to` instruction, we don't need to compute a list
  // of fields and/or values for the SQL query, since the fields and values are all
  // derived from the sub query. This allows us to keep the SQL statement lean.
  if (symbol?.type === 'query') {
    const { queryModel: subQueryModelSlug, queryInstructions: subQueryInstructions } =
      splitQuery(symbol.value);
    const subQueryModel = getModelBySlug(models, subQueryModelSlug);

    const subQuerySelectedFields = subQueryInstructions?.selecting;
    const subQueryIncludedFields = subQueryInstructions?.including;

    // Determine which fields will be returned by the sub query.
    const subQueryFields = [
      ...filterSelectedFields(subQueryModel, subQuerySelectedFields).map(
        (field) => field.slug,
      ),
      ...(subQueryIncludedFields
        ? Object.keys(
            flatten((subQueryIncludedFields || {}) as unknown as Record<string, unknown>),
          )
        : []),
    ];

    // Ensure that every field returned by the sub query is present in the model
    // of the root query, otherwise the fields of the sub query can't be used.
    for (const field of subQueryFields || []) {
      getFieldFromModel(model, field, { instructionName: 'to' });
    }

    let statement = '';

    // If specific fields were selected by the sub query, we need to list their respective
    // column names in the SQL statement, so that SQLite can reliably associate the values
    // retrieved by the sub query with the correct columns in the root query.
    if (subQuerySelectedFields) {
      const columns = subQueryFields.map((field) => {
        return getFieldFromModel(model, field, { instructionName: 'to' }).fieldSelector;
      });

      statement = `(${columns.join(', ')}) `;
    }

    statement += compileQueryInput(symbol.value, models, statementParams, {
      // biome-ignore lint/complexity/useSimplifiedLogicExpression: This is needed.
      inlineDefaults: options?.inlineDefaults || false,
    }).main.statement;
    return statement;
  }

  // Assign default field values to the provided instruction.
  Object.assign(toInstruction, defaultFields);

  // For link fields with the cardinality "many", we need to compose separate queries for
  // managing the records in the associative model, which is the model that is used to
  // establish the relationship between two other models, as those two do not share a
  // direct link.
  for (const fieldSlug in toInstruction) {
    if (!Object.hasOwn(toInstruction, fieldSlug)) continue;

    const fieldValue = toInstruction[fieldSlug];
    const fieldDetails = getFieldFromModel(
      model,
      fieldSlug,
      { instructionName: 'to' },
      false,
    );

    if (fieldDetails?.field.type === 'link' && fieldDetails.field.kind === 'many') {
      // Remove the field from the `to` instruction as it will be handled using
      // separate queries.
      delete toInstruction[fieldSlug];

      const associativeModelSlug = composeAssociationModelSlug(model, fieldDetails.field);

      const composeStatement = (
        subQueryType: 'add' | 'remove',
        value?: unknown,
      ): void => {
        const source = queryType === 'add' ? toInstruction : withInstruction;
        const recordDetails: Record<string, unknown> = { source };

        if (value) recordDetails.target = value;

        const query = compileQueryInput(
          {
            [subQueryType]: {
              [associativeModelSlug]: { with: recordDetails },
            },
          },
          models,
          [],
          // biome-ignore lint/complexity/useSimplifiedLogicExpression: This is needed.
          { returning: false, inlineDefaults: options?.inlineDefaults || false },
        ).main;

        // We are passing `after: true` here to ensure that the dependency statement is
        // executed after the main statement. This is necessary because, in the case that
        // the main statement creates a record, the record must of course first be
        // created before it can be referenced from the associative table.
        //
        // We could first check if the main query and dependency query are both of type
        // `add` and only then add the `after: true` property, but that would mean the
        // list of generated dependency statements differs depending what kind of action
        // is being performed, and that seems less clear in the output of the compiler.
        //
        // It seems clearer and more predictable to ensure that the dependency statements
        // required for interacting with associative tables are always executed after the
        // main statement, regardless of the type of action being performed.
        dependencyStatements.push({ ...query, after: true });
      };

      if (Array.isArray(fieldValue)) {
        // If a record is being updated, clear all existing records of the associative
        // model before inserting the new ones, to ensure that only the new ones are
        // present and no old ones remain.
        if (queryType === 'set') composeStatement('remove');

        for (const record of fieldValue) {
          composeStatement('add', record);
        }
      } else if (isObject(fieldValue)) {
        const value = fieldValue as {
          containing?: Array<FieldValue>;
          notContaining?: Array<FieldValue>;
        };

        for (const recordToAdd of value.containing || []) {
          composeStatement('add', recordToAdd);
        }

        for (const recordToRemove of value.notContaining || []) {
          composeStatement('remove', recordToRemove);
        }
      }
    }
  }

  let statement = composeConditions(models, model, statementParams, 'to', toInstruction, {
    parentModel: options?.parentModel,
    type: queryType === 'add' ? 'fields' : undefined,
  });

  if (queryType === 'add') {
    const deepStatement = composeConditions(
      models,
      model,
      statementParams,
      'to',
      toInstruction,
      {
        parentModel: options?.parentModel,
        type: 'values',
      },
    );

    statement = `(${statement}) VALUES (${deepStatement})`;
  } else if (queryType === 'set') {
    statement = `SET ${statement}`;
  }

  return statement;
};
