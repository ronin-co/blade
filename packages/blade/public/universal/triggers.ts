import type { Triggers } from '@/private/server/types';

type ArrayValues<T> = { [K in keyof T]: T[K][] };
type ArrayTriggers = ArrayValues<Triggers>;

export const triggers = (...list: Array<Triggers>): Triggers => {
  const final: Triggers = {};

  return final;
};
