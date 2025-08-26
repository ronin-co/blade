import { getFieldFromModel, getModelBySlug } from '@/src/model';
import type { InternalModelField, Model, ModelField } from '@/src/types/model';
import type { Instructions, QueryType } from '@/src/types/query';
import { compileQueryInput } from '@/src/utils';
import { QUERY_SYMBOLS, RAW_FIELD_TYPES, type RawFieldType } from '@/src/utils/constants';
import {
  composeMountingPath,
  flatten,
  getQuerySymbol,
  splitQuery,
} from '@/src/utils/helpers';
import {
  filterSelectedFields,
  parseFieldExpression,
  prepareStatementValue,
} from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `selecting` query instruction, which allows for
 * selecting a list of columns from rows.
 *
 * @param models - A list of models.
 * @param model - The model associated with the current query.
 * @param single - Whether a single or multiple records are being queried.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param queryType - The type of query that is being executed.
 * @param instructions - The instructions associated with the current query.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL string containing the columns that should be selected.
 */
export const handleSelecting = (
  models: Array<Model>,
  model: Model,
  statementParams: Array<unknown> | null,
  queryType: QueryType,
  single: boolean,
  instructions: {
    selecting: Instructions['selecting'];
    including: Instructions['including'];
    orderedBy: Instructions['orderedBy'];
    limitedTo: Instructions['limitedTo'];
  },
  options: {
    /** The path on which the selected fields should be mounted in the final record. */
    mountingPath?: InternalModelField['mountingPath'];
    /**
     * Whether to compute default field values as part of the generated statement.
     */
    inlineDefaults: boolean;
    /**
     * Whether to name columns explicitly in order to avoid conflicts arising when joining
     * multiple tables.
     */
    explicitColumns: boolean;
  } = { inlineDefaults: false, explicitColumns: true },
): { columns: string; isJoining: boolean; selectedFields: Array<InternalModelField> } => {
  let isJoining = false;

  // If specific fields were provided in the `selecting` instruction, select only the
  // columns of those fields. Otherwise, select all columns.
  const selectedFields: Array<InternalModelField> = filterSelectedFields(
    model,
    instructions.selecting,
  )
    .filter((field: ModelField) => !(field.type === 'link' && field.kind === 'many'))
    .map((field) => {
      const newField: InternalModelField = { ...field, mountingPath: field.slug };

      if (options.mountingPath && options.mountingPath !== 'ronin_root') {
        // Remove all occurrences of `{n}`, which are used to indicate the index of a join
        // that is being performed on the same nesting level of a record. Meaning if, for
        // example, multiple different tables are being joined and their outputs must all
        // be mounted on the same property of a record, `{n}` contains the index of the
        // join (whether it is the first join, the second one, or so on).
        newField.mountingPath = `${options.mountingPath.replace(/\{\d+\}/g, '')}.${field.slug}`;
      }

      return newField;
    });

  const joinedSelectedFields: Array<InternalModelField> = [];
  const joinedColumns: Array<string> = [];

  // If additional fields (that are not part of the model) were provided in the
  // `including` instruction, add ephemeral (non-stored) columns for those fields.
  if (instructions.including) {
    const symbol = getQuerySymbol(instructions.including);

    if (symbol?.type === 'query') {
      instructions.including.ronin_root = { ...instructions.including };
      delete instructions.including[QUERY_SYMBOLS.QUERY];
    }

    // Flatten the object to handle deeply nested ephemeral fields, which are the result
    // of developers providing objects as values in the `including` instruction.
    const flatObject = flatten(instructions.including);

    // Filter out any fields whose value is a sub query, as those fields are instead
    // converted into SQL JOINs in the `handleIncluding` function, which, in the case of
    // sub queries resulting in a single record, is more performance-efficient, and in
    // the case of sub queries resulting in multiple records, it's the only way to
    // include multiple rows of another table.
    for (const [key, value] of Object.entries(flatObject)) {
      const symbol = getQuerySymbol(value);

      // A JOIN is being performed.
      if (symbol?.type === 'query') {
        const { queryType, queryModel, queryInstructions } = splitQuery(symbol.value);
        const subQueryModel = getModelBySlug(models, queryModel);

        // If the query is of type `count`, generate a sub SQL statement for counting the
        // records and add the result as a selected column to the main query.
        if (queryType === 'count') {
          const subSelect = compileQueryInput(symbol.value, models, statementParams, {
            parentModel: { ...model, tableAlias: model.table },
            inlineDefaults: options.inlineDefaults,
          });

          selectedFields.push({
            slug: key,
            mountingPath: key,
            type: 'number',
            mountedValue: `(${subSelect.main.statement})`,
          });

          continue;
        }

        // If a sub query was found in the `including` instruction, that means different
        // tables will be joined later on during the compilation of the query.
        isJoining = true;

        const subSingle = queryModel !== subQueryModel.pluralSlug;

        // If multiple records are being joined and the root query only targets a single
        // record, we need to alias the root table, because it will receive a dedicated
        // SELECT statement in the `handleIncluding` function.
        //
        // And even if that's not the case, we need to set an explicit alias in order to
        // ensure that the columns of the root table are selected from the root table,
        // and not from the joined table.
        if (!model.tableAlias)
          model.tableAlias = single && !subSingle ? `sub_${model.table}` : model.table;

        const subMountingPath = composeMountingPath(subSingle, key, options.mountingPath);

        const { columns: nestedColumns, selectedFields: nestedSelectedFields } =
          handleSelecting(
            models,
            { ...subQueryModel, tableAlias: `including_${subMountingPath}` },
            statementParams,
            queryType,
            subSingle,
            {
              selecting: queryInstructions?.selecting,
              including: queryInstructions?.including,
              orderedBy: queryInstructions?.orderedBy,
              limitedTo: queryInstructions?.limitedTo,
            },
            { ...options, mountingPath: subMountingPath },
          );

        if (nestedColumns !== '*') joinedColumns.push(nestedColumns);
        joinedSelectedFields.push(...nestedSelectedFields);

        continue;
      }

      let mountedValue = value;

      if (symbol?.type === 'expression') {
        mountedValue = `(${parseFieldExpression(model, 'including', symbol.value)})`;
      } else {
        mountedValue = prepareStatementValue(statementParams, value);
      }

      // If a field with the same slug already exists, remove the previous field, since
      // only one field per slug should remain in the final list of selected fields.
      //
      // This might happen, for example, if a field is provided while adding a record,
      // but a field with the same slug is also provided in the `including` instruction,
      // which should overwrite the former.
      const existingField = selectedFields.findIndex((field) => field.slug === key);
      if (existingField > -1) selectedFields.splice(existingField, 1);

      selectedFields.push({
        slug: key,
        mountingPath: key,
        type: RAW_FIELD_TYPES.includes(typeof value as RawFieldType)
          ? (typeof value as RawFieldType)
          : 'string',
        mountedValue,
      });
    }
  }

  // Ensure that any fields used for ordering are always selected in the SQL statement,
  // if pagination is desired, because the pagination cursor that is constructed during
  // formatting of the records requires the values of all ordered fields.
  if (queryType === 'get' && !single && typeof instructions.limitedTo !== 'undefined') {
    // Compose a list of all the fields that were used for ordering.
    const orderedFields = (
      Object.values(instructions.orderedBy || {}).flat() as Array<string>
    ).map((fieldSlug) => {
      return getFieldFromModel(model, fieldSlug, { instructionName: 'orderedBy' });
    });

    for (const orderedField of orderedFields) {
      const { field } = orderedField;

      // Filter out ordered fields that were already selected.
      if (selectedFields.some(({ slug }) => slug === field.slug)) continue;

      // Add the field to the list of selected fields.
      selectedFields.push({
        slug: field.slug,
        mountingPath: field.slug,
        excluded: true,
      });
    }
  }

  let columnList = '*';

  if (options.explicitColumns) {
    const columns = selectedFields.map((selectedField) => {
      if (selectedField.mountedValue) {
        return `${selectedField.mountedValue} as "${selectedField.slug}"`;
      }

      const { fieldSelector } = getFieldFromModel(model, selectedField.slug, {
        instructionName: 'selecting',
      });

      if (options.mountingPath) {
        return `${fieldSelector} as "${options.mountingPath}.${selectedField.slug}"`;
      }

      return fieldSelector;
    });

    columnList = [...columns, ...joinedColumns].join(', ');
  }

  return {
    columns: columnList,
    isJoining,
    selectedFields: [...selectedFields, ...joinedSelectedFields],
  };
};
