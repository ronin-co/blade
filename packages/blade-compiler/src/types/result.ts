import type { Model, ModelField } from '@/src/types/model';

export type RawRow = Array<unknown>;
export type ObjectRow = Record<string, unknown>;

export type Row = RawRow | ObjectRow;

export type ResultRecordBase<T extends Date | string = string> = {
  /**
   * The unique identifier of the record.
   */
  id: string;

  ronin: {
    /**
     * The timestamp of when the record was created.
     */
    createdAt: T;
    /**
     * The ID of the user who created the record.
     */
    createdBy: string | null;
    /**
     * The timestamp of the last time the record was updated.
     */
    updatedAt: T;
    /**
     * The ID of the user who last updated the record.
     */
    updatedBy: string | null;
  };
};

export type ResultRecord = Record<string, unknown> & ResultRecordBase;

export type SingleRecordResult<T = ResultRecord> = {
  record: T | null;

  modelFields: Record<ModelField['slug'], ModelField['type']>;
};

export type MultipleRecordResult<T = ResultRecord> = {
  records: Array<T>;
  moreAfter?: string;
  moreBefore?: string;

  modelFields: Record<ModelField['slug'], ModelField['type']>;
};

export type AmountResult = {
  amount: number;
};

export type RegularResult<T = ResultRecord> =
  | SingleRecordResult<T>
  | MultipleRecordResult<T>
  | AmountResult;

export type ExpandedResult<T = ResultRecord> = {
  models: Record<Model['slug'], RegularResult<T>>;
};

export type Result<T = ResultRecord> = RegularResult<T> | ExpandedResult<T>;
