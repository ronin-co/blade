import {
  type AddQuery,
  type AlterQuery,
  type CountQuery,
  type CreateQuery,
  type DropQuery,
  type GetQuery,
  type ListQuery,
  type Model,
  type ModelField,
  type ModelIndex,
  type ModelPreset,
  QUERY_SYMBOLS,
  type QueryType,
  type RemoveQuery,
  type SetQuery,
} from 'blade-compiler';
import { getSyntaxProxy } from 'blade-syntax/queries';

export * from 'blade-syntax/schema';

const value = (queryType: QueryType) => ({ root: `${QUERY_SYMBOLS.QUERY}.${queryType}` });

type ModelValue = Model | ModelField | ModelIndex | ModelPreset;

// Query types for interacting with records.
export const get = getSyntaxProxy<GetQuery>(value('get'));
export const set = getSyntaxProxy<SetQuery>(value('set'));
export const add = getSyntaxProxy<AddQuery>(value('add'));
export const remove = getSyntaxProxy<RemoveQuery>(value('remove'));
export const count = getSyntaxProxy<CountQuery, number>(value('count'));

// Query types for interacting with the database schema.
export const list = getSyntaxProxy<ListQuery>(value('list'));
export const create = getSyntaxProxy<CreateQuery, Model>(value('create'));
export const alter = getSyntaxProxy<AlterQuery, ModelValue>(value('alter'));
export const drop = getSyntaxProxy<DropQuery, Model>(value('drop'));
