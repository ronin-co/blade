import type {
  Model as PartialModel,
  ModelField as PartialModelField,
} from '@ronin/compiler';

type RecursiveRequired<T> = {
  [K in keyof T]-?: T[K] extends object ? RecursiveRequired<T[K]> : T[K];
};

interface BaseModel {
  identifiers: {
    name: string;
    slug: string;
  };
  ronin: {
    createdAt: Date;
    updatedAt: Date;
  };
  summary?: string;
}

export type Model = Omit<RecursiveRequired<PartialModel>, 'identifiers'> & BaseModel;

export type ModelField = RecursiveRequired<PartialModelField>;
