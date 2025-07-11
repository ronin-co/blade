import type {
  InternalModelField,
  ModelField,
  ModelIndex,
  ModelPreset,
  Model as PrivateModel,
  PublicModel,
} from '@/src/types/model';
import {
  type DDL_QUERY_TYPES,
  type DML_QUERY_TYPES,
  QUERY_SYMBOLS,
} from '@/src/utils/constants';

// Query Types
export type QueryTypeEnum = (typeof DML_QUERY_TYPES)[number];
export type ModelQueryTypeEnum = (typeof DDL_QUERY_TYPES)[number];
export type ModelEntityEnum = 'field' | 'index' | 'preset';

// Field and Expressions
export type FieldValue = string | number | boolean | null | unknown;
export type FieldSelector = Record<string, FieldValue | StoredObject>;

export type StoredObject = {
  key: string;
  src: string;
  name: string | null;
  placeholder: {
    base64: string | null;
  } | null;
  meta: {
    size: number;
    type: string;
    width?: number;
    height?: number;
  };
};

export type Expression = {
  [QUERY_SYMBOLS.EXPRESSION]: string;
};

// With Instructions
export type WithInstructionRefinement =
  | FieldValue
  | {
      being?: FieldValue | Array<FieldValue>;
      notBeing?: FieldValue | Array<FieldValue>;

      startingWith?: FieldValue | Array<FieldValue>;
      notStartingWith?: FieldValue | Array<FieldValue>;

      endingWith?: FieldValue | Array<FieldValue>;
      notEndingWith?: FieldValue | Array<FieldValue>;

      containing?: FieldValue | Array<FieldValue>;
      notContaining?: FieldValue | Array<FieldValue>;

      greaterThan?: FieldValue | Array<FieldValue>;
      greaterOrEqual?: FieldValue | Array<FieldValue>;

      lessThan?: FieldValue | Array<FieldValue>;
      lessOrEqual?: FieldValue | Array<FieldValue>;
    };

export type WithInstruction =
  | Record<string, WithInstructionRefinement>
  | Record<string, Record<string, WithInstructionRefinement>>
  | Record<string, Array<WithInstructionRefinement>>
  | Record<string, Record<string, Array<WithInstructionRefinement>>>;

// Including Instructions
export type IncludingInstruction = Record<string, unknown | GetQuery>;

// Ordering Instructions
export type OrderedByInstruction = {
  ascending?: Array<string | Expression>;
  descending?: Array<string | Expression>;
};

// Using Instructions
export type UsingInstruction = Array<string> | Record<string, string>;

// Query Instructions
export type CombinedInstructions = {
  with?: WithInstruction | Array<WithInstruction>;
  to?: FieldSelector;
  including?: IncludingInstruction;
  selecting?: Array<string>;
  orderedBy?: OrderedByInstruction;
  before?: string | null;
  after?: string | null;
  limitedTo?: number;
  using?: UsingInstruction;
};

export type InstructionSchema =
  | 'with'
  | 'to'
  | 'including'
  | 'selecting'
  | 'orderedBy'
  | 'orderedBy.ascending'
  | 'orderedBy.descending'
  | 'before'
  | 'after'
  | 'limitedTo'
  | 'using';

// DML Query Types
export type GetQuery = Record<string, Omit<CombinedInstructions, 'to'> | null>;
export type SetQuery = Record<
  string,
  Omit<CombinedInstructions, 'to'> & { to: FieldSelector }
>;
export type AddQuery = Record<
  string,
  Omit<CombinedInstructions, 'with' | 'using'> & { with: FieldSelector }
>;
export type RemoveQuery = Record<string, Omit<CombinedInstructions, 'to'>>;
export type CountQuery = Record<string, Omit<CombinedInstructions, 'to'> | null>;

// DML Query Types — Addressing all models
export type AllQueryInstructions = {
  /**
   * Limit the list of models for which queries should be generated to only the models
   * that the provided model links to.
   */
  for?: PublicModel['slug'];
  /**
   * Provide query instructions for specific models.
   */
  on?: Record<PublicModel['slug'], Omit<CombinedInstructions, 'to'> | null>;
};

export type AllQuery = { all: AllQueryInstructions | null };

export type GetAllQuery = AllQuery;
export type CountAllQuery = AllQuery;

// DML Query Types — Individual Instructions
export type GetInstructions = Omit<CombinedInstructions, 'to'>;
export type SetInstructions = Omit<CombinedInstructions, 'to'> & { to: FieldSelector };
export type AddInstructions = Omit<CombinedInstructions, 'with' | 'using'> & {
  to: FieldSelector;
};
export type RemoveInstructions = Omit<CombinedInstructions, 'to'>;
export type CountInstructions = Omit<CombinedInstructions, 'to'>;
export type Instructions =
  | GetInstructions
  | SetInstructions
  | AddInstructions
  | RemoveInstructions
  | CountInstructions;

// DDL Query Types - Individual Instructions
export type ListQuery = { models?: null } | { model: string };

export type CreateQuery = {
  model: string | PublicModel;
  to?: PublicModel;
};

export type AlterQuery = {
  model: string;
  to?: Partial<Omit<PublicModel, 'fields' | 'indexes' | 'presets' | 'idPrefix'>>;
  create?: {
    field?: Omit<ModelField, 'system'>;
    index?: Omit<ModelIndex, 'system'>;
    preset?: Omit<ModelPreset, 'system'>;
  };
  alter?:
    | {
        field?: string;
        to?: Partial<Omit<ModelField, 'system'>>;
      }
    | {
        index?: string;
        to?: Partial<Omit<ModelIndex, 'system'>>;
      }
    | {
        preset?: string;
        to?: Omit<ModelPreset, 'system'>;
      };
  drop?: Partial<Record<ModelEntityEnum, string>>;
};

export type DropQuery = {
  model: string;
};

// DDL Query Types
export type ModelQuery =
  | {
      list: ListQuery;
    }
  | {
      create: CreateQuery;
    }
  | {
      alter: AlterQuery;
    }
  | {
      drop: DropQuery;
    };

// Pagination Options
export type QueryPaginationOptions = {
  moreBefore?: string | null;
  moreAfter?: string | null;
};

export type Query = {
  // DML Query Types
  get?: GetQuery | GetAllQuery;
  set?: SetQuery;
  add?: AddQuery;
  remove?: RemoveQuery;
  count?: CountQuery | CountAllQuery;

  // DDL Query Types
  list?: ListQuery;
  create?: CreateQuery;
  alter?: AlterQuery;
  drop?: DropQuery;
};

// Utility Types
export type QueryType = QueryTypeEnum | ModelQueryTypeEnum;
export type QueryInstructionType = InstructionSchema;
export type QuerySchemaType = Partial<Record<string, Partial<CombinedInstructions>>>;
export type ModelQueryType = ModelQueryTypeEnum;
export type ModelEntityType = ModelEntityEnum;

export interface Statement {
  statement: string;
  params: Array<unknown>;
  returning?: boolean;
}

export interface InternalQuery {
  /** The RONIN query for which the SQL statement was generated. */
  query: Query;
  /** The RONIN model fields that were selected for the SQL statement. */
  selectedFields: Array<Array<InternalModelField>>;
  /** The RONIN models that are being affected by the query. */
  models: Array<PrivateModel>;
}

export interface InternalDependencyStatement extends Statement {
  /**
   * By default, the dependency statement is run before the main statement. By setting
   * `after` to `true`, the dependency statement is run after the main statement instead.
   */
  after?: boolean;
}
