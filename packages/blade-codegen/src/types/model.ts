import type { ModelField as PartialModelField } from 'blade-compiler';

type RecursiveRequired<T> = {
  [K in keyof T]-?: T[K] extends object ? RecursiveRequired<T[K]> : T[K];
};

export type ModelField = RecursiveRequired<PartialModelField>;
