import { TRIGGER_TYPES, getTriggerName } from 'blade-client/utils';
import { QUERY_TYPES } from 'blade-compiler';

import type { Triggers } from '@/private/server/types';

export const triggers = (...list: Array<Triggers>): Triggers => {
  const final: Triggers = {};

  for (const triggerType of TRIGGER_TYPES) {
    for (const queryType of QUERY_TYPES) {
      const method = getTriggerName(triggerType, queryType);

      for (const group of list) {
        const addedFunction = group[method];
        if (!addedFunction) continue;

        const existingFunction = final[method];
        if (!existingFunction) {
          // @ts-expect-error - This is a valid assignment.
          final[method] = addedFunction;
          continue;
        }

        if (triggerType === 'before' || triggerType === 'after') {
          // @ts-expect-error - This is a valid assignment.
          final[method] = async (options) => {
            // @ts-expect-error - This is a valid assignment.
            const existing = await existingFunction(options);
            // @ts-expect-error - This is a valid assignment.
            const added = await addedFunction(options);

            return [
              ...(typeof existing === 'function' ? existing() : existing),
              ...(typeof added === 'function' ? added() : added),
            ];
          };

          continue;
        }

        if (triggerType === 'during') {
          // @ts-expect-error - This is a valid assignment.
          final[method] = async (options) => {
            // @ts-expect-error - This is a valid assignment.
            const existing = await existingFunction(options);
            // @ts-expect-error - This is a valid assignment.
            return addedFunction({ ...options, query: existing });
          };
        }

        // Triggers of type "resolving" cannot be chained, since a second function cannot
        // be executed once the first function already provided the result.

        if (triggerType === 'following') {
          // @ts-expect-error - This is a valid assignment.
          final[method] = async (options) => {
            // @ts-expect-error - This is a valid assignment.
            await Promise.all([existingFunction(options), addedFunction(options)]);
          };
        }
      }
    }
  }

  return final;
};
