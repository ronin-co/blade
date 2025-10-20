import { deserializeError as deserialize } from 'serialize-error';

import * as errors from '@/public/universal/errors';

const errorClasses = Object.values(errors);

export const deserializeError = (errorObject: unknown) => {
  const result = deserialize(errorObject);

  for (const ErrorClass of errorClasses) {
    const errorInstance = new ErrorClass(errorObject as any);

    if (errorInstance.name === (errorObject as { name: string })?.name) {
      return errorInstance;
    }
  }

  return result;
};
