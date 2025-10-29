export type {
  Trigger,
  Triggers,
  TriggerOptions,
  TableOfContents,
} from '@/private/server/types';

export type * from 'blade-client';
export type * from 'blade-client/types';

// TODO: Import from compiler package.
type ResultRecordBase<T extends Date | string = string> = {
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

// TODO: Import from syntax package.
/**
 * Utility type to mark all Function.prototype methods as "deprecated" which
 * deranks them in the IDE suggestion popup.
 */
export interface ReducedFunction {
  /**
   * @deprecated
   */
  name: any;
  /**
   * @deprecated
   */
  length: never;
  /**
   * @deprecated
   */
  apply: never;
  /**
   * @deprecated
   */
  call: never;
  /**
   * @deprecated
   */
  bind: never;
  /**
   * @deprecated
   */
  toString: never;
  /**
   * @deprecated
   */
  caller: never;
  /**
   * @deprecated
   */
  prototype: never;
  /**
   * @deprecated
   */
  arguments: never;
  /**
   * @deprecated
   */
  unify: never;
}
