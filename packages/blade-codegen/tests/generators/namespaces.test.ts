import { describe, expect, test } from 'bun:test';
import {
  blob,
  boolean,
  date,
  json,
  link,
  model,
  number,
  string,
} from 'blade-syntax/schema';

import { generateNamespaces } from '@/src/generators/namespaces';
import { printNodes } from '@/src/utils/print';

import type { PopulatedModel as Model } from 'blade-compiler';

describe('namespaces', () => {
  test('with a basic model', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        avatar: blob(),
        email: string({ required: true }),
        isActive: boolean(),
        lastActiveAt: date(),
        name: string(),
        rewardPoints: number({ defaultValue: 0, required: true }),
        settings: json({ defaultValue: {}, required: true }),
      },
    }) as unknown as Model;

    const typesResult = generateNamespaces([AccountModel]);

    expect(typesResult).toHaveLength(5);

    const typesResultStr = printNodes(typesResult);

    expect(typesResultStr).toMatchSnapshot();
  });

  test('with a link field', () => {
    const AccountModel = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: string(),
        email: string({ required: true }),
      },
    }) as unknown as Model;

    const PostModel = model({
      slug: 'post',
      pluralSlug: 'posts',
      fields: {
        title: string(),
        author: link({ target: 'account' }),
      },
    }) as unknown as Model;

    const typesResult = generateNamespaces([AccountModel, PostModel]);

    expect(typesResult).toHaveLength(6);

    const typesResultStr = printNodes(typesResult);

    expect(typesResultStr).toMatchSnapshot();
  });

  test('with no models', () => {
    const typesResult = generateNamespaces([]);

    expect(typesResult).toHaveLength(4);

    const typesResultStr = printNodes(typesResult);

    expect(typesResultStr).toMatchSnapshot();
  });
});
