import { deserializeError as deserialize } from 'serialize-error';

export const deserializeError = (errorObject: unknown) => {
  const result = deserialize(errorObject);

  return result;
};
