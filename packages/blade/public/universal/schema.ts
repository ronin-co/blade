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
import { type DeepCallable, getSyntaxProxy } from 'blade-syntax/queries';

export * from 'blade-syntax/schema';

const value = (queryType: QueryType) => ({ root: `${QUERY_SYMBOLS.QUERY}.${queryType}` });

type ModelValue = Model | ModelField | ModelIndex | ModelPreset;

// Query types for interacting with records.
export const get = getSyntaxProxy<GetQuery>(value('get')) as DeepCallable<GetQuery>;
export const set = getSyntaxProxy<SetQuery>(value('set')) as DeepCallable<SetQuery>;
export const add = getSyntaxProxy<AddQuery>(value('add')) as DeepCallable<AddQuery>;
export const remove = getSyntaxProxy<RemoveQuery>(
  value('remove'),
) as DeepCallable<RemoveQuery>;
export const count = getSyntaxProxy<CountQuery, number>(value('count')) as DeepCallable<
  CountQuery,
  number
>;

// Query types for interacting with the database schema.
export const list = getSyntaxProxy<ListQuery>(value('list')) as DeepCallable<ListQuery>;
export const create = getSyntaxProxy<CreateQuery, Model>(value('create')) as DeepCallable<
  CreateQuery,
  Model
>;
export const alter = getSyntaxProxy<AlterQuery, ModelValue>(
  value('alter'),
) as DeepCallable<AlterQuery, ModelValue>;
export const drop = getSyntaxProxy<DropQuery, Model>(value('drop')) as DeepCallable<
  DropQuery,
  Model
>;
