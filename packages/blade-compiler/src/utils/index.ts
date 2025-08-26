import { handleBeforeOrAfter } from '@/src/instructions/before-after';
import { handleIncluding } from '@/src/instructions/including';
import { handleLimitedTo } from '@/src/instructions/limited-to';
import { handleOrderedBy } from '@/src/instructions/ordered-by';
import { handleSelecting } from '@/src/instructions/selecting';
import { handleTo } from '@/src/instructions/to';
import { handleUsing } from '@/src/instructions/using';
import { handleWith } from '@/src/instructions/with';
import {
  ROOT_MODEL_WITH_ATTRIBUTES,
  getModelBySlug,
  transformMetaQuery,
} from '@/src/model';
import type { InternalModelField, Model } from '@/src/types/model';
import type {
  CombinedInstructions,
  Instructions,
  InternalDependencyStatement,
  Query,
  SetInstructions,
  Statement,
} from '@/src/types/query';
import { DML_QUERY_TYPES_WRITE, QUERY_SYMBOLS } from '@/src/utils/constants';
import { CompilerError, isObject, splitQuery } from '@/src/utils/helpers';
import { formatIdentifiers } from '@/src/utils/statement';

/**
 * Composes an SQL statement for a provided RONIN query.
 *
 * @param query - The RONIN query for which an SQL statement should be composed.
 * @param models - A list of models.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param options - Additional options to adjust the behavior of the statement generation.
 *
 * @returns The composed SQL statement.
 */
export const compileQueryInput = (
  defaultQuery: Query,
  models: Array<Model>,
  // In order to prevent SQL injections and allow for faster query execution, we're not
  // inserting any values into the SQL statement directly. Instead, we will pass them to
  // SQLite's API later on, so that it can prepare an object that the database can
  // execute in a safe and fast manner. SQLite allows strings, numbers, and booleans to
  // be provided as values.
  statementParams: Array<unknown> | null,
  options?: {
    /** Whether the query should explicitly return records. Defaults to `true`. */
    returning?: boolean;
    /**
     * If the query is contained within another query, this option should be set to the
     * model of the parent query. Like that, it becomes possible to reference fields of
     * the parent model in the nested query (the current query).
     */
    parentModel?: Model;
    /**
     * Whether to name columns explicitly in order to avoid conflicts arising when joining
     * multiple tables. Defaults to `true`.
     */
    explicitColumns?: boolean;
    /**
     * Whether to compute default field values as part of the generated statement.
     */
    inlineDefaults: boolean;
  },
): {
  dependencies: Array<InternalDependencyStatement>;
  main: Statement;
  selectedFields: Array<InternalModelField>;
  model: Model;
  updatedQuery: Query;
} => {
  // A list of write statements that are required to be executed before the main read
  // statement. Their output is not relevant for the main statement, as they are merely
  // used to update the database in a way that is required for the main read statement
  // to return the expected results.
  const dependencyStatements: Array<InternalDependencyStatement> = [];

  // If the query is a meta query of type `create`, `alter`, or `drop`, we need to
  // transform it into a regular query before it can be processed further.
  const query = transformMetaQuery(
    models,
    dependencyStatements,
    statementParams,
    defaultQuery,
    {
      // biome-ignore lint/complexity/useSimplifiedLogicExpression: This is needed.
      inlineDefaults: options?.inlineDefaults || false,
    },
  );

  // If no further query processing should happen, we need to return early. This happens
  // when the root model is created.
  if (query === null)
    return {
      dependencies: [],
      main: dependencyStatements[0],
      selectedFields: [],
      model: ROOT_MODEL_WITH_ATTRIBUTES,
      updatedQuery: defaultQuery,
    };

  // Split out the individual components of the query.
  const parsedQuery = splitQuery(query);
  const { queryType, queryModel, queryInstructions } = parsedQuery;

  // Find the model that the query is interacting with.
  const model = getModelBySlug(models, queryModel);

  // Whether the query will interact with a single record, or multiple at the same time.
  const single = queryModel !== model.pluralSlug;

  // Walk deeper into the query, to the level on which the actual instructions (such as
  // `with` and `including`) are located.
  let instructions = formatIdentifiers(model, queryInstructions);

  const returning = options?.returning ?? true;

  // Apply any presets that are potentially being selected by the query.
  if (instructions && typeof instructions.using !== 'undefined') {
    instructions = handleUsing(model, instructions);
  }

  // If a `count` query was provided, ensure that the final select statement only includes
  // a single column that contains the amount of records that were matched by the query.
  if (queryType === 'count') {
    if (!instructions) instructions = {} as Instructions & SetInstructions;

    instructions!.selecting = ['amount'];
    instructions!.including = Object.assign(instructions?.including || {}, {
      amount: {
        [QUERY_SYMBOLS.EXPRESSION]: 'COUNT(*)',
      },
    });
  }

  // If a `limitedTo` instruction was provided, that means the amount of records returned
  // by the query will be limited to a specific amount, which, in turn, means that
  // pagination is activated automatically, so a cursor will be provided to the client
  // that can be used to retrieve the next page of records.
  //
  // Since `limitedTo` automatically activates pagination, we have to make sure that, if
  // the instruction is provided, we also automatically provide an `orderedBy`
  // instruction, as pagination requires the records to be ordered by at least one
  // specific column, otherwise the cursor wouldn't work, since the order of the rows
  // might differ between pages.
  if (
    !single &&
    ((queryType === 'get' && instructions?.limitedTo) ||
      (queryType === 'count' && (instructions?.before || instructions?.after)))
  ) {
    instructions = instructions || {};
    instructions.orderedBy = instructions.orderedBy || {};
    instructions.orderedBy.ascending = instructions.orderedBy.ascending || [];
    instructions.orderedBy.descending = instructions.orderedBy.descending || [];

    if (
      ![
        ...instructions.orderedBy.ascending,
        ...instructions.orderedBy.descending,
      ].includes('ronin.createdAt')
    ) {
      // It's extremely important that the item is added to the end of the array,
      // otherwise https://linear.app/ronin/issue/RON-1084 would occur.
      instructions.orderedBy.descending.push('ronin.createdAt');
    }
  }

  // A list of columns that should be selected when querying records.
  const { columns, isJoining, selectedFields } = handleSelecting(
    models,
    model,
    statementParams,
    queryType,
    single,
    {
      selecting: instructions?.selecting,
      including: instructions?.including,
      orderedBy: instructions?.orderedBy,
      limitedTo: instructions?.limitedTo,
    },
    {
      inlineDefaults: options?.inlineDefaults ?? false,
      explicitColumns: options?.explicitColumns ?? true,
    },
  );

  let statement = '';

  switch (queryType) {
    case 'get':
    case 'count':
      statement += `SELECT ${columns} FROM `;
      break;

    case 'set':
      statement += 'UPDATE ';
      break;

    case 'add':
      statement += 'INSERT INTO ';
      break;

    case 'remove':
      statement += 'DELETE FROM ';
      break;
  }

  let isJoiningMultipleRows = false;

  if (isJoining) {
    const { statement: including, tableSubQuery } = handleIncluding(
      models,
      model,
      statementParams,
      single,
      {
        with: instructions?.with,
        orderedBy: instructions?.orderedBy,
        including: instructions?.including,
      },
    );

    // If multiple rows are being joined from a different table, even though the root
    // query is only supposed to return a single row, we need to ensure a limit for the
    // root query *before* joining the other rows. Otherwise, if the limit sits at the
    // end of the full query, only one row would be available at the end.
    if (tableSubQuery) {
      statement += `(${tableSubQuery}) as ${model.tableAlias} `;
      isJoiningMultipleRows = true;

      // Remove the instructions that are now being handled by the sub query.
      delete instructions?.['with'];
      delete instructions?.['orderedBy'];
    } else {
      statement += `"${model.table}" `;
    }

    statement += `${including} `;
  } else {
    statement += `"${model.table}" `;
  }

  if (queryType === 'add' || queryType === 'set') {
    const instructionName = queryType === 'add' ? 'with' : 'to';
    const instructionValue = instructions![instructionName] as CombinedInstructions['to'];

    // This validation must be performed before any default fields (such as `ronin`) are
    // added to the record. Otherwise there are always fields present.
    if (
      !(instructionValue && isObject(instructionValue)) ||
      Object.keys(instructionValue).length === 0
    ) {
      throw new CompilerError({
        message: `When using a \`${queryType}\` query, the \`${instructionName}\` instruction must be a non-empty object.`,
        code: instructionName === 'to' ? 'INVALID_TO_VALUE' : 'INVALID_WITH_VALUE',
        queries: [query],
      });
    }

    const toStatement = handleTo(
      models,
      model,
      statementParams,
      queryType,
      dependencyStatements,
      { with: instructions!.with, to: instructionValue },
      options,
    );

    statement += `${toStatement} `;
  }

  const conditions: Array<string> = [];

  // Queries of type "get", "set", "remove", or "count" all support filtering records,
  // but those of type "add" do not.
  if (queryType !== 'add' && instructions && Object.hasOwn(instructions, 'with')) {
    const withStatement = handleWith(
      models,
      model,
      statementParams,
      instructions!.with,
      options?.parentModel,
    );

    if (withStatement.length > 0) conditions.push(withStatement);
  }

  if (
    instructions &&
    (typeof instructions.before !== 'undefined' ||
      typeof instructions.after !== 'undefined')
  ) {
    if (single) {
      throw new CompilerError({
        message:
          'The `before` and `after` instructions are not supported when querying for a single record.',
        code: 'INVALID_BEFORE_OR_AFTER_INSTRUCTION',
        queries: [query],
      });
    }

    const beforeAndAfterStatement = handleBeforeOrAfter(
      model,
      statementParams,
      queryType,
      {
        before: instructions.before,
        after: instructions.after,
        with: instructions.with,
        orderedBy: instructions.orderedBy,
        limitedTo: instructions.limitedTo,
      },
    );

    conditions.push(beforeAndAfterStatement);
  }

  if (conditions.length > 0) {
    // If multiple conditions are available, wrap them in parentheses to ensure that the
    // AND/OR comparisons are asserted correctly.
    if (conditions.length === 1) {
      statement += `WHERE ${conditions[0]} `;
    } else {
      statement += `WHERE (${conditions.join(' ')}) `;
    }
  }

  if (instructions?.orderedBy) {
    const orderedByStatement = handleOrderedBy(model, instructions.orderedBy);
    statement += `${orderedByStatement} `;
  }

  if (
    queryType === 'get' &&
    !isJoiningMultipleRows &&
    (single || instructions?.limitedTo)
  ) {
    statement += handleLimitedTo(single, instructions?.limitedTo);
  }

  // For queries that modify records, we want to make sure that the modified record is
  // returned after the modification has been performed.
  if ((DML_QUERY_TYPES_WRITE as ReadonlyArray<string>).includes(queryType) && returning) {
    statement += `RETURNING ${columns}`;
  }

  const mainStatement: Statement = {
    statement: statement.trimEnd(),
    params: statementParams || [],
  };

  // We are setting this property separately to make sure it doesn't even exist if the
  // query doesn't return any output. This makes it easier for developers to visually
  // distinguish queries that return output from those that don't, when looking at the
  // output produced by the compiler.
  if (returning) mainStatement.returning = true;

  return {
    dependencies: dependencyStatements,
    main: mainStatement,
    selectedFields,
    model,
    updatedQuery: query,
  };
};
