import type { StoredObject } from 'blade-compiler';

export type StorableObject = {
  query: {
    index: number;
    type: 'set' | 'add';
  };
  name?: string;
  schema: string;
  field: string;
  value?: any;
  contentType: string;
  reference: StoredObject | null;
};

export type StorableObjectValue = File | ReadableStream | Buffer | ArrayBuffer | Blob;
