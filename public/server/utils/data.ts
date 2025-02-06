import '../../../private/server/types/global.d.ts';

import { hooks } from 'file-list';
import initializeClient from 'ronin';

import { getRoninOptions } from '../../../private/server/utils/data.ts';
import { SERVER_CONTEXT } from '../../../private/server/worker/context.ts';
import { prepareHooks } from '../../../private/server/worker/data-hooks';

const { add, get, set, remove, count, batch } = initializeClient(() => {
  const serverContext = SERVER_CONTEXT.getStore();

  if (!serverContext) throw new Error('Missing server context for data hooks.');

  return getRoninOptions(serverContext.requestContext, {
    hooks: prepareHooks(serverContext, hooks),
  });
});

export { add, get, set, remove, count, batch };
