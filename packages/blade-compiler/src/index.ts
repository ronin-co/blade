import {
  ROOT_MODEL,
  ROOT_MODEL_WITH_ATTRIBUTES,
  getModelBySlug,
  getSystemModels,
} from '@/src/model';
import {
  addDefaultModelAttributes,
  addDefaultModelFields,
  addDefaultModelPresets,
} from '@/src/model/defaults';
import type {
  InternalModelField,
  Model as PrivateModel,
  PublicModel,
} from '@/src/types/model';
import type {
  AllQueryInstructions,
  CombinedInstructions,
  InternalQuery,
  Query,
  QueryType,
  Statement,
} from '@/src/types/query';
import type {
  DatabaseResult,
  ExpandedResult,
  MultipleRecordResult,
  ObjectRow,
  RawRow,
  RegularResult,
  Result,
  ResultRecord,
} from '@/src/types/result';
import { compileQueryInput } from '@/src/utils';
import {
  CompilerError,
  deleteProperty,
  getProperty,
  omit,
  setProperty,
  splitQuery,
} from '@/src/utils/helpers';
import { generatePaginationCursor } from '@/src/utils/pagination';

interface TransactionOptions {
  /** A list of models that already exist in the database. */
  models?: Array<PublicModel>;
  /**
   * Place statement parameters directly inside the statement strings instead of
   * separating them out into a dedicated `params` array.
   */
  inlineParams?: boolean;
  /**
   * Whether to compute default field values as part of the generated statement.
   */
  inlineDefaults?: boolean;
  /**
   * Applies a default `limitedTo` instruction to queries obtaining multiple records.
   * Useful for environments in which memory is tightly constrained.
   */
  defaultRecordLimit?: number;
}

class Transaction {
  statements: Array<Statement> = [];
  models: Array<PrivateModel> = [];

  #internalQueries: Array<InternalQuery> = [];

  constructor(queries: Array<Query>, options?: TransactionOptions) {
    const models = options?.models || [];

    this.#internalQueries = queries.map((query) => ({
      query,
      selectedFields: [],
      models: [],
    }));

    this.#compileQueries(models, options);
  }

  /**
   * Composes SQL statements for the provided RONIN queries.
   *
   * @param models - A list of models.
   * @param options - Additional options to adjust the behavior of the statement generation.
   *
   * @returns The composed SQL statements.
   */
  #compileQueries = (
    models: Array<PublicModel>,
    options?: Omit<TransactionOptions, 'models'>,
  ): Array<Statement> => {
    const modelsWithAttributes = models.map((model) => {
      return addDefaultModelAttributes(model, true);
    });

    const modelsWithFields = [
      ...modelsWithAttributes.flatMap((model) => {
        return getSystemModels(modelsWithAttributes, model);
      }),
      ...[ROOT_MODEL_WITH_ATTRIBUTES, ...modelsWithAttributes],
    ].map((model) => {
      return addDefaultModelFields(model, true);
    });

    const modelsWithPresets = modelsWithFields.map((model) => {
      return addDefaultModelPresets(modelsWithFields, model);
    });

    const statements: Array<Statement> = [];

    // Check if the list of queries contains any queries with the model `all`, as those
    // must be expanded into multiple queries.
    const expandedQueries: Array<{ query: Query; index: number; expansion?: boolean }> =
      this.#internalQueries.flatMap(({ query }, index) => {
        const { queryType, queryModel, queryInstructions } = splitQuery(query);

        // If the model defined in the query is called `all`, that means we need to expand
        // the query into multiple queries: One for each model.
        if (queryModel === 'all') {
          const {
            for: forInstruction,
            on: onInstruction,
            ...restInstructions
          } = (queryInstructions || {}) as AllQueryInstructions;

          let modelList = modelsWithPresets.filter((model) => {
            return model.slug !== ROOT_MODEL.slug;
          });

          // If a `for` instruction was provided, that means we only want to select the
          // related models of the model that was provided in `for`, instead of selecting
          // all models at once.
          if (forInstruction) {
            const mainModel = getModelBySlug(modelList, forInstruction);

            modelList = Object.values(mainModel.fields || {})
              .filter((field) => field.type === 'link')
              .map((field) => {
                return modelList.find(
                  (model) => model.slug === field.target,
                ) as PrivateModel;
              });
          }

          return modelList.map((model) => {
            const instructions = Object.assign(
              {},
              restInstructions,
              onInstruction?.[model.pluralSlug],
            );

            const query: Query = {
              [queryType]: { [model.pluralSlug]: instructions },
            };

            return { query, index, expansion: true };
          });
        }

        return { query, index };
      });

    for (const { query, index, expansion } of expandedQueries) {
      const { dependencies, main, selectedFields, model, updatedQuery } =
        compileQueryInput(query, modelsWithPresets, options?.inlineParams ? null : [], {
          inlineDefaults: options?.inlineDefaults || false,
          defaultRecordLimit: options?.defaultRecordLimit,
        });

      // Every query can only produce one main statement (which can return output), but
      // multiple dependency statements (which must be executed either before or after
      // the main one, but cannot return output themselves).
      //
      // The main statements, unlike the dependency statements, are expected to produce
      // output, and that output should be a 1:1 match between RONIN queries and SQL
      // statements, meaning one RONIN query should produce one main SQL statement.
      const preDependencies = dependencies.filter(({ after }) => !after);
      const postDependencies = dependencies
        .map(({ after, ...rest }) => (after ? rest : null))
        .filter((item) => item != null);
      const subStatements = [...preDependencies, main, ...postDependencies];

      // These statements will be made publicly available (outside the compiler).
      this.statements.push(...subStatements);

      // Update the internal query with additional information.
      this.#internalQueries[index].selectedFields.push(selectedFields);
      this.#internalQueries[index].models.push(model);

      // Unless the query is the result of expanding a query that addresses multiple
      // models, we need to update the query to reflect any potential changes that might
      // have been applied to it during its compilation. For example, this happens when
      // DDL (Data Definition Language) queries are compiled internally.
      if (!expansion) this.#internalQueries[index].query = updatedQuery;
    }

    this.models = modelsWithPresets;

    return statements;
  };

  #formatRows<RecordType = ResultRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: true,
  ): RecordType;
  #formatRows<RecordType = ResultRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: false,
  ): Array<RecordType>;

  #formatRows<RecordType = ResultRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: boolean,
  ): RecordType | Array<RecordType> {
    const records: Array<ResultRecord> = [];

    for (const row of rows) {
      const record = fields.reduce((acc, field, fieldIndex) => {
        let newSlug = field.mountingPath;
        let newValue = row[fieldIndex];

        // If the value of the field isn't empty, format it.
        if (newValue !== null) {
          if (field.type === 'json' || field.type === 'blob') {
            newValue = JSON.parse(newValue as string);
          } else if (field.type === 'boolean') {
            newValue = Boolean(newValue);
          }
        }

        const { parentField, parentIsArray } = ((): {
          parentField: string | null;
          parentIsArray?: true;
        } => {
          const lastDotIndex = newSlug.lastIndexOf('.');
          if (lastDotIndex === -1) return { parentField: null };

          const parent = newSlug.slice(0, lastDotIndex);

          if (parent.endsWith('[0]')) {
            return { parentField: parent.slice(0, -3), parentIsArray: true };
          }

          return { parentField: parent };
        })();

        if (parentField) {
          // If the field is nested into another field and the current field is the ID of
          // a nested record, we need to set the parent field to `null` if the ID is
          // empty, because IDs are always defined, so if the ID is empty, that means the
          // nested record doesn't exist.
          //
          // Similarily, if the parent field is an array, the value we are saving should
          // be an empty array instead of `null`.
          if (field.slug === 'id' && newValue === null) {
            newSlug = parentField;
            newValue = parentIsArray ? [] : null;
          }

          const parentFields = newSlug
            .split('.')
            .map((_, index, array) => array.slice(0, index + 1).join('.'))
            .reverse();

          // If one of the parent fields of the current field is set to `null` or an
          // empty array, that means the nested record doesn't exist, so we can skip
          // setting the current field, since its value is `null` anyways.
          if (
            parentFields.some((item) => {
              const isArray = item.endsWith('[0]');
              const value = getProperty(acc, item.replaceAll('[0]', ''));
              return isArray
                ? Array.isArray(value) && value.length === 0
                : value === null;
            })
          ) {
            return acc;
          }
        }

        setProperty(acc, newSlug, newValue);
        return acc;
      }, {} as ResultRecord);

      const existingRecord = record.id
        ? records.find((existingRecord) => {
            return existingRecord.id === record.id;
          })
        : null;

      // In the most common scenario that there isn't already a record with the same ID
      // as the current row, we can simply add the record to the list of records.
      //
      // If there is already a record with the same ID, however, that means the current
      // row is the result of a JOIN operation, in which case we need to push the values
      // of the current row into the arrays on the existing record.
      if (!existingRecord) {
        records.push(record);
        continue;
      }

      const joinFields = fields.reduce((acc, { mountingPath }) => {
        if (mountingPath.includes('[0]')) acc.add(mountingPath.split('[0]')[0]);
        return acc;
      }, new Set<string>());

      for (const arrayField of joinFields.values()) {
        const currentValue = existingRecord[arrayField] as Array<ResultRecord>;
        const newValue = record[arrayField] as Array<ResultRecord>;

        for (const newRecord of newValue) {
          if ('id' in newRecord) {
            const existingIndex = currentValue.findIndex((value) => {
              return value.id === newRecord.id;
            });

            if (existingIndex > -1) {
              Object.assign(currentValue[existingIndex], newRecord);
              continue;
            }
          }

          currentValue.push(newRecord);
        }
      }
    }

    return single ? (records[0] as RecordType) : (records as Array<RecordType>);
  }

  /**
   * Formats an individual result of a query (each query has one individual result).
   *
   * @param queryType - The type of query that is being executed.
   * @param queryInstructions - The instructions of the query that is being executed.
   * @param model - The model for which the query is being executed.
   * @param rows - The rows that were returned from the database for the query (in the
   * form of an array containing arrays that contain strings).
   * @param selectedFields - The model fields that were selected by the query.
   * @param single - Whether a single or multiple records are being affected by the query.
   *
   * @returns A formatted RONIN result for a particular query.
   */
  formatIndividualResult<RecordType>(
    queryType: QueryType,
    queryInstructions: CombinedInstructions,
    model: PrivateModel,
    rows: Array<Array<RawRow>>,
    selectedFields: Array<InternalModelField>,
    single: boolean,
  ): RegularResult<RecordType> {
    // Allows the client to format fields whose type cannot be serialized in JSON,
    // which is the format in which the compiler output is sent to the client.
    const modelFields = Object.fromEntries(
      Object.entries(model.fields).map(([slug, rest]) => [slug, rest.type]),
    );

    // The query is expected to count records.
    if (queryType === 'count') {
      return { amount: rows[0][0] as unknown as number };
    }

    // The query is targeting a single record.
    if (single) {
      return {
        record: rows[0] ? this.#formatRows<RecordType>(selectedFields, rows, true) : null,
        modelFields,
      };
    }

    const pageSize = queryInstructions?.limitedTo;

    // The query is targeting multiple records.
    const result: MultipleRecordResult<RecordType> = {
      records: this.#formatRows<RecordType>(selectedFields, rows, false),
      modelFields,
    };

    // If the amount of records was limited to a specific amount, that means pagination
    // should be activated. This is only possible if the query matched any records.
    if (pageSize && result.records.length > 0) {
      // Pagination cursor for the next page.
      if (result.records.length > pageSize) {
        // Remove one record from the list, because we always load one too much, in
        // order to see if there are more records available.
        if (queryInstructions?.before) {
          result.records.shift();
        } else {
          result.records.pop();
        }

        const direction = queryInstructions?.before ? 'moreBefore' : 'moreAfter';
        const lastRecord = result.records.at(
          direction === 'moreAfter' ? -1 : 0,
        ) as ResultRecord;

        result[direction] = generatePaginationCursor(
          model,
          queryInstructions.orderedBy,
          lastRecord,
        );
      }

      // Pagination cursor for the previous page. Only available if an existing
      // cursor was provided in the query instructions.
      if (queryInstructions?.before || queryInstructions?.after) {
        const direction = queryInstructions?.before ? 'moreAfter' : 'moreBefore';
        const firstRecord = result.records.at(
          direction === 'moreAfter' ? -1 : 0,
        ) as ResultRecord;

        result[direction] = generatePaginationCursor(
          model,
          queryInstructions.orderedBy,
          firstRecord,
        );
      }
    }

    // Remove any fields that are marked as `excluded` from the result.
    for (const field of selectedFields) {
      if (!field.excluded) continue;

      for (const record of result.records) {
        deleteProperty(record, field.slug);
      }
    }

    return result;
  }

  /**
   * Format the results returned from the database into Blade records.
   *
   * @param results - A list of results from the database, where each result is an array
   * of rows.
   * @param caller - A function that invokes a database and executes a provided list of
   * SQL statements on it. The return signature contains a `results` property holding an
   * array of results, where each result is an array of rows. Additionally, the `raw`
   * property determines whether rows are objects (`false`) or arrays of values (`true`).
   * The latter is preferred, since that is how SQL databases return rows by default.
   *
   * @returns A list of formatted Blade results, where each result is either a single
   * Blade record, an array of Blade records, or a Blade count result.
   */
  async formatResults<RecordType>(
    caller: (statements: Array<Statement>) => Promise<DatabaseResult> | DatabaseResult,
  ): Promise<Array<Result<RecordType>>> {
    let results: Array<Array<RawRow>> | Array<Array<ObjectRow>> | undefined;
    let raw: boolean;

    try {
      const output = await caller(this.statements);

      results = output.results;
      raw = 'raw' in output ? output.raw : false;
    } catch (err) {
      // Match any error that contains a `statement` property to a query and expose it.
      // This ensures that any data source in `databaseCaller` can trigger the error,
      // since we don't rely on a specific error class.
      if (err instanceof Error && 'statement' in err) {
        const statement = err.statement as Pick<Statement, 'sql' | 'params'>;

        const index = this.statements.findIndex((item) => {
          return (
            item.sql === statement.sql &&
            JSON.stringify(item.params) === JSON.stringify(statement.params)
          );
        });

        const { query } = this.#internalQueries[index];

        throw new CompilerError({
          message: err.message as string,
          code: 'QUERY_EXECUTION_FAILED',
          queries: [query],
        });
      }
    }

    // Only retain the results of SQL statements that are expected to return data.
    const cleanResults = results!.filter((_, index) => this.statements[index].returning);

    let resultIndex = 0;

    return this.#internalQueries.reduce(
      (finalResults: Array<Result<RecordType>>, internalQuery) => {
        const { query, selectedFields, models: affectedModels } = internalQuery;
        const { queryType, queryModel, queryInstructions } = splitQuery(query);

        // If the provided results are raw (rows being arrays of values, which is the most
        // ideal format in terms of performance, since the driver doesn't need to format
        // the rows in that case), we can already continue processing them further.
        //
        // If the provided results were already formatted by the driver (rows being
        // objects), we need to normalize them into the raw format first, before they can
        // be processed, since the object format provided by the driver does not match
        // the RONIN record format expected by developers.
        const absoluteResults = raw
          ? (cleanResults as Array<Array<Array<RawRow>>>)
          : (cleanResults.map((rows) => {
              return rows.map((row) => {
                // If the row is already an array, return it as-is.
                if (Array.isArray(row)) return row;

                // If the row is the result of a `count` query, return its amount result.
                if (queryType === 'count') return [row.amount];

                // If the row is an object, return its values as an array.
                return Object.values(row);
              });
            }) as Array<Array<Array<RawRow>>>);

        if (queryModel === 'all') {
          const models: ExpandedResult<RecordType>['models'] = {};

          const { on: onInstruction, ...restInstructions } = (queryInstructions ||
            {}) as AllQueryInstructions;

          for (let index = 0; index < affectedModels.length; index++) {
            const model = affectedModels[index];
            const fields = selectedFields[index];

            const instructions = Object.assign(
              {},
              restInstructions,
              onInstruction?.[model.pluralSlug],
            );

            const result = this.formatIndividualResult<RecordType>(
              queryType,
              instructions,
              model,
              absoluteResults[resultIndex++],
              fields,
              false,
            );

            models[model.pluralSlug] = result;
          }

          finalResults.push({ models });
        } else {
          const model = affectedModels[0];
          const fields = selectedFields[0];

          const result = this.formatIndividualResult<RecordType>(
            queryType,
            queryInstructions,
            model,
            absoluteResults[resultIndex++],
            fields,
            queryModel !== model.pluralSlug,
          );

          finalResults.push(result);
        }

        return finalResults;
      },
      [] as Array<Result<RecordType>>,
    );
  }
}

// Expose model types
export type {
  PublicModel as Model,
  Model as PopulatedModel,
  ModelField,
  ModelIndex,
  ModelPreset,
} from '@/src/types/model';

// Expose query types
export type {
  // Queries
  Query,
  QueryType,
  QueryInstructionType as QueryInstruction,
  QuerySchemaType,
  // Query Types
  GetQuery,
  GetInstructions,
  GetInstructions as GetQueryInstructions,
  SetQuery,
  SetInstructions,
  SetInstructions as SetQueryInstructions,
  AddQuery,
  AddInstructions,
  AddInstructions as AddQueryInstructions,
  RemoveQuery,
  RemoveInstructions,
  RemoveInstructions as RemoveQueryInstructions,
  CountQuery,
  CountInstructions,
  CountInstructions as CountQueryInstructions,
  ListQuery,
  CreateQuery,
  AlterQuery,
  DropQuery,
  // Query Instructions
  WithInstruction,
  CombinedInstructions,
  // Compiled Queries
  Statement,
  // Miscellaneous
  StoredObject,
  // Expressions
  Expression,
} from '@/src/types/query';

// Expose result types
export type {
  Result,
  RegularResult,
  ExpandedResult,
  ResultRecord,
  ResultRecordBase,
  RawRow,
  ObjectRow,
  DatabaseResult,
} from '@/src/types/result';

// Strip any properties from the root model that are internal
const CLEAN_ROOT_MODEL = omit(ROOT_MODEL, ['system']) as PublicModel;

// Expose the main `Transaction` entrypoint and the root model
export { Transaction, CLEAN_ROOT_MODEL as ROOT_MODEL };

// Expose the main error class and helper functions
export { CompilerError, getQuerySymbol } from '@/src/utils/helpers';

// Expose constants
export {
  QUERY_SYMBOLS,
  QUERY_TYPES,
  QUERY_TYPES_READ,
  QUERY_TYPES_WRITE,
  DML_QUERY_TYPES,
  DML_QUERY_TYPES_READ,
  DML_QUERY_TYPES_WRITE,
  DDL_QUERY_TYPES,
  DDL_QUERY_TYPES_READ,
  DDL_QUERY_TYPES_WRITE,
} from '@/src/utils/constants';
