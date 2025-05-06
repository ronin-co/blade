import '../../../private/server/types/global.d.ts';

import { triggers } from 'file-list';
import initializeClient from 'ronin';

import { getRoninOptions } from '../../../private/server/utils/data.ts';
import { SERVER_CONTEXT } from '../../../private/server/worker/context.ts';
import { prepareTriggers } from '../../../private/server/worker/triggers.ts';

const { add, get, set, remove, count, list, create, alter, drop, batch } =
  initializeClient(() => {
    const serverContext = SERVER_CONTEXT.getStore();

    if (!serverContext) throw new Error('Missing server context for triggers.');

    return getRoninOptions(
      serverContext.requestContext,
      prepareTriggers(serverContext, triggers, false),
    );
  });

export { add, get, set, remove, count, list, create, alter, drop, batch };
