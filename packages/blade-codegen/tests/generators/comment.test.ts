import { describe, expect, test } from 'bun:test';

import { generateQueryTypeComment } from '@/src/generators/comment';

import type { Model } from '@/src/types/model';

describe('comment', () => {
  describe('add', () => {
    test('with model name', () => {
      const model = { name: 'Account', slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'add');
      expect(comment).toMatchSnapshot();
    });
    test('with model slug', () => {
      const model = { slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'add');
      expect(comment).toMatchSnapshot();
    });
  });

  describe('count', () => {
    test('with model name', () => {
      const model = { name: 'Account', slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'count');
      expect(comment).toMatchSnapshot();
    });
    test('with model slug', () => {
      const model = { slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'count');
      expect(comment).toMatchSnapshot();
    });
  });

  describe('get', () => {
    test('with model name', () => {
      const model = { name: 'Account', slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'get');
      expect(comment).toMatchSnapshot();
    });
    test('with model slug', () => {
      const model = { slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'get');
      expect(comment).toMatchSnapshot();
    });
  });

  describe('remove', () => {
    test('with model name', () => {
      const model = { name: 'Account', slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'remove');
      expect(comment).toMatchSnapshot();
    });
    test('with model slug', () => {
      const model = { slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'remove');
      expect(comment).toMatchSnapshot();
    });
  });

  describe('set', () => {
    test('with model name', () => {
      const model = { name: 'Account', slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'set');
      expect(comment).toMatchSnapshot();
    });
    test('with model slug', () => {
      const model = { slug: 'account' } as Model;
      const comment = generateQueryTypeComment(model, 'set');
      expect(comment).toMatchSnapshot();
    });
  });
});
