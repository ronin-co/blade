import { expect, test } from 'bun:test';
import {
  type SyntaxField,
  blob,
  boolean,
  date,
  json,
  link,
  number,
  string,
} from '@/src/schema';

test('create string field', () => {
  const field = string() as unknown as SyntaxField<'string'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'string',
  });
});

test('create string field with attributes', () => {
  const field = string({
    required: true,
    name: 'Surname',
  }) as unknown as SyntaxField<'string'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'string',
    name: 'Surname',
    required: true,
  });
});

test('create number field', () => {
  const field = number() as unknown as SyntaxField<'number'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'number',
  });
});

test('create number field with attributes', () => {
  const field = number({
    required: true,
    name: 'Follower',
  }) as unknown as SyntaxField<'number'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'number',
    name: 'Follower',
    required: true,
  });
});

test('create boolean field', () => {
  const field = boolean() as unknown as SyntaxField<'boolean'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'boolean',
  });
});

test('create boolean field with attributes', () => {
  const field = boolean({
    required: true,
    name: 'Registered',
  }) as unknown as SyntaxField<'boolean'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'boolean',
    name: 'Registered',
    required: true,
  });
});

test('create date field', () => {
  const field = date() as unknown as SyntaxField<'date'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'date',
  });
});

test('create date field with attributes', () => {
  const field = date({
    required: true,
    name: 'Registered',
  }) as unknown as SyntaxField<'date'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'date',
    name: 'Registered',
    required: true,
  });
});

test('create blob field', () => {
  const field = blob() as unknown as SyntaxField<'blob'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'blob',
  });
});

test('create blob field with attributes', () => {
  const field = blob({
    required: true,
    name: 'Registered',
  }) as unknown as SyntaxField<'blob'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'blob',
    name: 'Registered',
    required: true,
  });
});

test('create json field', () => {
  const field = json() as unknown as SyntaxField<'json'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'json',
    name: undefined,
  });
});

test('create json field with attributes', () => {
  const field = json({
    required: true,
    name: 'Registered',
  }) as unknown as SyntaxField<'json'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'json',
    name: 'Registered',
    required: true,
  });
});

test('create link field', () => {
  const field = link({
    target: 'account',
  }) as unknown as SyntaxField<'link'>;

  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'link',
    target: 'account',
  });
});

test('create link field with attributes', () => {
  const field = link({
    target: 'account',
    required: true,
    name: 'Profile',
  }) as unknown as SyntaxField<'link'>;
  expect(field).toBeTypeOf('object');

  expect(field).toEqual({
    type: 'link',
    target: 'account',
    name: 'Profile',
    required: true,
  });
});
