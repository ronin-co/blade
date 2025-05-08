import initializeClient from 'ronin';
import { triggers } from 'server-list';

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

type FactoryType = ReturnType<typeof initializeClient>;

export const get = factory.get as FactoryType['get'];
export const set = factory.set as FactoryType['set'];
export const add = factory.add as FactoryType['add'];
export const remove = factory.remove as FactoryType['remove'];
export const count = factory.count as FactoryType['count'];

export const list = factory.list as FactoryType['list'];
export const create = factory.create as FactoryType['create'];
export const alter = factory.alter as FactoryType['alter'];
export const drop = factory.drop as FactoryType['drop'];

export const batch = factory.batch as FactoryType['batch'];
