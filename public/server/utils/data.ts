import '../../../private/server/types/global.d.ts';

import { effects } from 'file-list';
import initializeClient from 'ronin';

import { getRoninOptions } from '../../../private/server/utils/data.ts';
import { SERVER_CONTEXT } from '../../../private/server/worker/context.ts';
import { prepareEffects } from '../../../private/server/worker/effects.ts';

const { add, get, set, remove, count, list, create, alter, drop, batch } =
  initializeClient(() => {
    const serverContext = SERVER_CONTEXT.getStore();

    if (!serverContext) throw new Error('Missing server context for effects.');

    return getRoninOptions(
      serverContext.requestContext,
      prepareEffects(serverContext, effects, false),
    );
  });

export { add, get, set, remove, count, list, create, alter, drop, batch };
