import {
  add,
  alter,
  batch,
  count,
  create,
  drop,
  get,
  list,
  remove,
  set,
  sql,
  sqlBatch,
} from 'blade-client';

import {
  convertWhereClause,
  getModel,
  transformInput,
  transformOrderedBy,
  transformOutput,
} from '@/transform';

import type { Adapter, AdapterInstance } from 'better-auth/types';
import type { createSyntaxFactory } from 'blade-client';
import type { ResultRecordBase } from 'blade-compiler';

type SyntaxFactory = ReturnType<typeof createSyntaxFactory>;

/**
 * Create a new Better Auth adapter to communicate with RONIN.
 *
 * @param [client] - A RONIN syntax factory instance.
 *
 * @returns A Better Auth adapter to communicate with RONIN
 *
 * @example
 * ```ts
 * import { ronin } from '@ronin/better-auth';
 * import { betterAuth } from 'better-auth';
 *
 * const auth = betterAuth({
 *    database: ronin()
 * });
 * ```
 *
 * @example
 * ```ts
 * import { ronin } from '@ronin/better-auth';
 * import { createSyntaxFactory } from 'ronin';
 * import { betterAuth } from 'better-auth';
 *
 * const client = createSyntaxFactory({
 *    token: '1234'
 * });
 * const auth = betterAuth({
 *    database: ronin(client)
 * });
 * ```
 */
export const ronin = (client?: SyntaxFactory): AdapterInstance => {
  return (): Adapter => {
    const factory = client ?? {
      add,
      alter,
      batch,
      count,
      create,
      drop,
      get,
      list,
      remove,
      set,
      sql,
      sqlBatch,
    };

    return {
      id: 'ronin',
      count: async ({ model: slug, where = [] }) => {
        const model = await getModel(factory, slug);
        const instructions = convertWhereClause(where);
        const transformed = await transformInput(instructions, slug);
        return factory.count[model.pluralSlug].with<number>(transformed);
      },
      create: async ({ data, model }) => {
        const transformed = await transformInput(data, model);
        const record = await factory.add[model].with<ResultRecordBase<Date>>(transformed);
        return transformOutput(record);
      },
      delete: async ({ model, where = [] }) => {
        const instructions = convertWhereClause(where);
        await factory.remove[model].with(instructions);
      },
      deleteMany: async ({ model: slug, where = [] }) => {
        const model = await getModel(factory, slug);
        const instructions = convertWhereClause(where);
        const transformed = await transformInput(instructions, slug);
        const results =
          await factory.remove[model.pluralSlug].with<Array<object>>(transformed);
        return results.length;
      },
      findMany: async ({ model: slug, limit, offset, sortBy, where = [] }) => {
        const model = await getModel(factory, slug);
        const instructions = convertWhereClause(where);
        const transformed = await transformInput(instructions, slug);
        const results = await factory.get[model.pluralSlug]<
          Array<ResultRecordBase<Date>>
        >({
          after: offset?.toString(),
          limitedTo: limit,
          orderedBy: transformOrderedBy(sortBy),
          with: transformed,
        });

        return results.map((result) => transformOutput(result));
      },
      findOne: async ({ model, where }) => {
        const instructions = convertWhereClause(where);
        const result = await factory.get[model].with<ResultRecordBase<Date> | null>(
          instructions,
        );
        return transformOutput(result);
      },
      update: async ({ model, update, where = [] }) => {
        const instructions = convertWhereClause(where);
        const transformed = await transformInput(update, model);
        const result = await factory.set[model]<ResultRecordBase<Date> | null>({
          with: instructions,
          to: transformed as Record<string, unknown>,
        });
        return transformOutput(result);
      },
      updateMany: async ({ model: slug, update, where = [] }) => {
        const model = await getModel(factory, slug);
        const instructions = convertWhereClause(where);
        const transformed = (await transformInput(update, slug)) as Record<
          string,
          unknown
        >;
        const results = await factory.set[model.pluralSlug]<Array<object>>({
          to: transformed,
          with: instructions,
        });
        return results.length;
      },
    } as Adapter;
  };
};

export default ronin;
