import { TRIGGER_TYPES, getMethodName } from 'blade-client/utils';
import { QUERY_TYPES } from 'blade-compiler';

import type { Triggers } from '@/private/server/types';

//// SYNTAX PACKAGE

export const triggers = (...list: Array<Triggers>): Triggers => {
  const final: Triggers = {};

  for (const triggerType of TRIGGER_TYPES) {
    for (const queryType of QUERY_TYPES) {
      const method = getMethodName(triggerType, queryType);

      for (const group of list) {
        const addedFunction = group[method];
        if (!addedFunction) continue;

        const existingFunction = final[method];
        if (!existingFunction) {
          final[method] = addedFunction;
          continue;
        }

        if (triggerType === 'before' || triggerType === 'after') {
          final[method] = (options) => {
            const existing = existingFunction(options);
            const added = addedFunction(options);

            return [
              ...(typeof existing === 'function' ? existing() : existing),
              ...(typeof added === 'function' ? added() : added),
            ];
          };

          continue;
        }

        if (triggerType === 'during') {
          final[method] = (options) => {
            const existing = existingFunction(options);
            return addedFunction({ ...options, query: existing });
          };
        }
      }
    }
  }

  return final;
};
