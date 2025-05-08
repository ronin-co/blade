import type { DeepCallable, PromiseTuple } from '@ronin/syntax/queries';
import initializeClient from 'ronin';
import { triggers } from 'server-list';

import type {
  AlterQuery,
  CreateQuery,
  DropQuery,
  ListQuery,
  Model,
  ModelField,
  ModelIndex,
  ModelPreset,
} from '@ronin/compiler';
import type { AddQuery, CountQuery, GetQuery, RemoveQuery, SetQuery } from 'ronin/types';
import { getRoninOptions } from '../../../private/server/utils/data.ts';
import { SERVER_CONTEXT } from '../../../private/server/worker/context.ts';
import { prepareTriggers } from '../../../private/server/worker/triggers.ts';

const factory = initializeClient(() => {
  const serverContext = SERVER_CONTEXT.getStore();

  if (!serverContext) throw new Error('Missing server context for triggers.');

  return getRoninOptions(
    serverContext.requestContext,
    prepareTriggers(serverContext, triggers, false),
  );
});

export const get = factory.get as DeepCallable<GetQuery>;
export const set = factory.set as DeepCallable<SetQuery>;
export const add = factory.add as DeepCallable<AddQuery>;
export const remove = factory.remove as DeepCallable<RemoveQuery>;
export const count = factory.count as DeepCallable<CountQuery, number>;

export const list = factory.list as DeepCallable<ListQuery>;
export const create = factory.create as DeepCallable<CreateQuery, Model>;
export const alter = factory.alter as DeepCallable<
  AlterQuery,
  Model | ModelField | ModelIndex | ModelPreset
>;
export const drop = factory.drop as DeepCallable<DropQuery, Model>;

export const batch = factory.batch as <
  T extends [Promise<any>, ...Array<Promise<any>>] | Array<Promise<any>>,
>(
  operations: () => T,
  queryOptions?: Record<string, unknown>,
) => Promise<PromiseTuple<T>>;
