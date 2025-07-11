import { describe, expect, test } from 'bun:test';
import { getSyntaxProxy } from '@/src/queries';
import { blob, boolean, date, json, link, model, number, string } from '@/src/schema';
import { type GetQuery, QUERY_SYMBOLS, type StoredObject } from 'blade-compiler';
import { expectTypeOf } from 'expect-type';

describe('models', () => {
  test('create empty model', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
    });

    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create empty model with name', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create empty model with plural name', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      pluralName: 'Accounts',
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      pluralName: 'Accounts',
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create empty model without plural slug', () => {
    const Account = model({
      slug: 'account',
      name: 'Account',
      fields: {},
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      name: 'Account',
      fields: {},
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create empty model with name and plural name', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      pluralName: 'Accounts',
      fields: {},
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      pluralName: 'Accounts',
      fields: {},
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create empty model with identifier', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      identifiers: {
        name: 'Account',
        slug: 'account',
      },
      fields: {},
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      identifiers: {
        name: 'Account',
        slug: 'account',
      },
      fields: {},
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create empty model with id prefix', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
      idPrefix: 'acc_',
      fields: {},
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      idPrefix: 'acc_',
      fields: {},
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create simple model', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ required: true }),
      },
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: {
          type: 'string',
          required: true,
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
    }>();
  });

  test('create simple model with blob field', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ required: true }),
        avatar: blob(),
      },
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: {
          type: 'string',
          required: true,
        },
        avatar: {
          type: 'blob',
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
      avatar: StoredObject;
    }>();
  });

  test('create simple model with json field', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ required: true }),
        bio: json(),
      },
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: {
          type: 'string',
          required: true,
        },
        bio: {
          type: 'json',
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
      bio: object;
    }>();
  });

  test('create simple model with date field', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ required: true }),
        birthday: date(),
      },
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: {
          type: 'string',
          required: true,
        },
        birthday: {
          type: 'date',
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
      birthday: Date;
    }>();
  });

  test('create simple model with custom field name', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ required: true, name: 'CusToM NaMe' }),
      },
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: {
          name: 'CusToM NaMe',
          type: 'string',
          required: true,
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
    }>();
  });

  test('create simple model with field name inferred from slug', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        createdAt: string({ required: true }),
      },
    });
    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        createdAt: {
          type: 'string',
          required: true,
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      createdAt: string;
    }>();
  });

  test('create model with multiple fields', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ required: true }),
        email: string(),
        emailVerified: boolean(),
        password: string(),
        follower: number(),
      },
    });

    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: {
          type: 'string',
          required: true,
        },
        email: {
          type: 'string',
        },
        emailVerified: {
          type: 'boolean',
        },
        password: {
          type: 'string',
        },
        follower: {
          type: 'number',
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
      email: string;
      emailVerified: boolean;
      password: string;
      follower: number;
    }>();
  });

  test('create model with unique field', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ unique: true }),
      },
    });

    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: {
          type: 'string',
          unique: true,
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
    }>();
  });

  test('create model with link field', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',

      fields: {
        name: string({ required: true }),
      },
    });

    const Post = model({
      slug: 'post',
      pluralSlug: 'posts',

      fields: {
        author: link({
          target: 'account',
          actions: {
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        }),
      },
    });

    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        name: {
          type: 'string',
          required: true,
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
    }>();

    expect(Post).toBeTypeOf('object');

    expect(Post).toEqual({
      // @ts-expect-error: The Post object has 'slug'.
      slug: 'post',
      pluralSlug: 'posts',

      fields: {
        author: {
          type: 'link',
          target: 'account',
          actions: {
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        },
      },
    });

    expectTypeOf(Post).toEqualTypeOf<{
      id: string;
      ronin: string;
      author: string;
    }>();
  });

  test('create model with index', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      fields: {
        name: string({ required: true }),
      },
      indexes: {
        name: {
          fields: [{ slug: 'name', order: 'ASC', collation: 'BINARY' }],
        },
      },
    });
    expect(Account).toBeTypeOf('object');
    // @ts-expect-error: The Account object has 'fields'.
    expect(Object.keys(Account.fields)).toHaveLength(1);

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      name: 'Account',
      fields: {
        name: {
          type: 'string',
          required: true,
        },
      },
      indexes: {
        name: {
          fields: [{ slug: 'name', order: 'ASC', collation: 'BINARY' }],
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      name: string;
    }>();
  });

  test('create model with invalid index field', () => {
    try {
      model({
        slug: 'account',
        pluralSlug: 'accounts',
        name: 'Account',
        fields: {
          name: string({ required: true }),
        },
        indexes: {
          name: {
            fields: [
              // @ts-expect-error This is intended.
              { slug: 'thisFieldDoesNotExist', order: 'ASC', collation: 'BINARY' },
            ],
          },
        },
      });
    } catch (err) {
      const error = err as Error;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(
        'The field thisFieldDoesNotExist does not exist in this model.',
      );
    }
  });

  test('create model with empty index field', () => {
    try {
      model({
        slug: 'account',
        pluralSlug: 'accounts',
        name: 'Account',
        fields: {
          name: string({ required: true }),
        },
        indexes: {
          name: {
            // @ts-expect-error Types should block users from doing this
            fields: [],
          },
        },
      });
    } catch (err) {
      const error = err as Error;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('An index must have at least one field.');
    }
  });

  test('create model with presets', () => {
    const Account = model({
      slug: 'account',
      // fields: {},
      presets: {
        onlyName: {
          instructions: {
            with: {
              space: {
                being: 'spa_m9h8oha94helaji',
              },
            },
            selecting: ['name'],
          },
        },
      },
    });

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      presets: {
        onlyName: {
          instructions: {
            with: {
              space: {
                being: 'spa_m9h8oha94helaji',
              },
            },
            selecting: ['name'],
          },
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
    }>();
  });

  test('create model with presets including sub queries', () => {
    const getProxy = getSyntaxProxy<GetQuery>({ root: `${QUERY_SYMBOLS.QUERY}.get` });

    const Member = model({
      slug: 'member',
      fields: {
        account: string(),
      },
      presets: (f) => ({
        account: {
          instructions: {
            including: {
              // @ts-expect-error This will be improved shortly.
              account: getProxy.account.with.id(f.account),
            },
          },
        },
      }),
    });

    expect(Member).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'member',
      fields: {
        account: {
          type: 'string',
        },
      },
      presets: {
        account: {
          instructions: {
            including: {
              account: {
                [QUERY_SYMBOLS.QUERY]: {
                  get: {
                    account: {
                      with: {
                        id: {
                          [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD}account`,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    expectTypeOf(Member).toEqualTypeOf<{
      id: string;
      ronin: string;
      account: string;
    }>();
  });

  test('create model with nested fields', () => {
    const Account = model({
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        address: {
          country: string({ required: true }),
          city: string(),
        },
      },
    });

    expect(Account).toBeTypeOf('object');

    expect(Account).toEqual({
      // @ts-expect-error: The Account object has 'slug'.
      slug: 'account',
      pluralSlug: 'accounts',
      fields: {
        address: {
          country: {
            type: 'string',
            required: true,
          },
          city: {
            type: 'string',
          },
        },
      },
    });

    expectTypeOf(Account).toEqualTypeOf<{
      id: string;
      ronin: string;
      address: {
        country: string;
        city: string;
      };
    }>();
  });
});
