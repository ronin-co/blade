import { describe, expect, spyOn, test } from 'bun:test';

import { op } from '@/src/helpers/expressions';
import { type SyntaxItem, getBatchProxy, getSyntaxProxy } from '@/src/queries';
import { concat, string } from '@/src/schema';
import {
  type AddQuery,
  type AlterQuery,
  type CreateQuery,
  type DropQuery,
  type GetQuery,
  type Model,
  type ModelField,
  type ModelIndex,
  type ModelPreset,
  QUERY_SYMBOLS,
  type Query,
  type SetQuery,
} from 'blade-compiler';
import { expectTypeOf } from 'expect-type';

describe('syntax proxy', () => {
  test('using sub query', () => {
    let addQuery: Query | undefined;

    const getQueryHandler = { callback: () => undefined };
    const getQueryHandlerSpy = spyOn(getQueryHandler, 'callback');

    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: getQueryHandlerSpy,
    });
    const addProxy = getSyntaxProxy<AddQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.add`,
      callback: (value) => {
        addQuery = value;
      },
    });

    addProxy.accounts.with(() => getProxy.oldAccounts.selecting(['handle']));

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        add: {
          accounts: {
            with: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  oldAccounts: {
                    selecting: ['handle'],
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(getQueryHandlerSpy).not.toHaveBeenCalled();
    expect(addQuery).toMatchObject(finalQuery);
  });

  test('using multiple sub queries', () => {
    let getQuery: Query | undefined;

    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: (value) => {
        getQuery = value;
      },
    });

    getProxy.member.including((f) => ({
      // @ts-expect-error This will be improved shortly.
      account: getProxy.account.with.id(f.account),
      // @ts-expect-error This will be improved shortly.
      team: getProxy.team.with.id(f.team),
    }));

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        get: {
          member: {
            including: {
              account: {
                __RONIN_QUERY: {
                  get: {
                    account: {
                      with: {
                        id: {
                          [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}account`,
                        },
                      },
                    },
                  },
                },
              },
              team: {
                __RONIN_QUERY: {
                  get: {
                    team: {
                      with: {
                        id: {
                          [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}team`,
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
    };

    expect(getQuery).toMatchObject(finalQuery);
  });

  test('using field with expression', () => {
    let setQuery: Query | undefined;

    const setProxy = getSyntaxProxy<SetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.set`,
      callback: (value) => {
        setQuery = value;
      },
    });

    setProxy.accounts.to((f) => ({
      name: concat(f.firstName, ' ', f.lastName),
    }));

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        set: {
          accounts: {
            to: {
              name: {
                [QUERY_SYMBOLS.EXPRESSION]: `concat(${QUERY_SYMBOLS.FIELD}firstName, ' ', ${QUERY_SYMBOLS.FIELD}lastName)`,
              },
            },
          },
        },
      },
    };

    expect(setQuery).toMatchObject(finalQuery);
  });

  test('using field with date', () => {
    let setQuery: Query | undefined;

    const setProxy = getSyntaxProxy<SetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.set`,
      callback: (value) => {
        setQuery = value;
      },
    });

    const date = new Date();

    setProxy.member({
      with: { id: '1234' },
      to: { activeAt: date },
    });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        set: {
          member: {
            with: { id: '1234' },
            to: { activeAt: date },
          },
        },
      },
    };

    expect(setQuery).toMatchObject(finalQuery);
  });

  test('using field with file', () => {
    let setQuery: Query | undefined;

    const setProxy = getSyntaxProxy<SetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.set`,
      callback: (value) => {
        setQuery = value;
      },
      replacer: (value: unknown) => (value instanceof File ? value : undefined),
    });

    const file = new File(['test'], 'test.txt');

    setProxy.account({
      with: { id: '1234' },
      to: { avatar: file },
    });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        set: {
          account: {
            with: { id: '1234' },
            to: { avatar: file },
          },
        },
      },
    };

    expect(setQuery).toMatchObject(finalQuery);
  });

  test('using `undefined` instruction options`', () => {
    let getQuery: Query | undefined;

    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: (value) => {
        getQuery = value;
      },
    });

    getProxy.accounts({
      after: undefined,
    });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        get: {
          accounts: {},
        },
      },
    };

    expect(getQuery).toBeDefined();
    expect(getQuery).toStrictEqual(
      // @ts-expect-error `toMatchObject` does not work for nullish properties.
      finalQuery,
    );
  });

  test('using `undefined` instruction callable parameter`', () => {
    let getQuery: Query | undefined;

    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: (value) => {
        getQuery = value;
      },
    });

    getProxy.accounts.after(undefined);

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        get: {
          accounts: {
            after: {},
          },
        },
      },
    };

    expect(getQuery).toBeDefined();
    expect(getQuery).toStrictEqual(
      // @ts-expect-error `toMatchObject` does not work for nullish properties.
      finalQuery,
    );
  });

  // Since `name` is a native property of functions and queries contain function calls,
  // we have to explicitly assert whether it can be used as a field slug.
  test('using field with slug `name`', () => {
    let getQuery: Query | undefined;

    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: (value) => {
        getQuery = value;
      },
    });

    getProxy.accounts.with.name('test');

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        get: {
          accounts: {
            with: {
              name: 'test',
            },
          },
        },
      },
    };

    expect(getQuery).toMatchObject(finalQuery);
  });

  test('using field with `defaultValue` expression', () => {
    let createQuery: Query | undefined;

    const createProxy = getSyntaxProxy<CreateQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.create`,
      callback: (value) => {
        createQuery = value;
      },
    });

    createProxy.model({
      slug: 'account',
      fields: {
        name: string().defaultValue(() => op('Hello', '||', 'World')),
      } as any,
    });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        create: {
          model: {
            slug: 'account',
            fields: {
              name: {
                type: 'string',
                defaultValue: {
                  __RONIN_EXPRESSION: "('Hello' || 'World')",
                },
              },
            },
          },
        },
      },
    };

    expect(createQuery).toMatchObject(finalQuery);
  });

  test('using field with `check` expression', () => {
    let createQuery: Query | undefined;

    const createProxy = getSyntaxProxy<CreateQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.create`,
      callback: (value) => {
        createQuery = value;
      },
    });

    createProxy.model({
      slug: 'account',
      fields: {
        name: string().check((fields) => op(fields.name, '=', 'World')),
      } as any,
    });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        create: {
          model: {
            slug: 'account',
            fields: {
              name: {
                type: 'string',
                check: {
                  __RONIN_EXPRESSION: "(__RONIN_FIELD_name = 'World')",
                },
              },
            },
          },
        },
      },
    };

    expect(createQuery).toMatchObject(finalQuery);
  });

  test('using field with `computedAs` expression', () => {
    let createQuery: Query | undefined;

    const createProxy = getSyntaxProxy<CreateQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.create`,
      callback: (value) => {
        createQuery = value;
      },
    });

    createProxy.model({
      slug: 'account',
      fields: {
        name: string().computedAs((fields) => ({
          kind: 'VIRTUAL',
          value: op(fields.name, '||', 'World'),
        })),
      } as any,
    });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        create: {
          model: {
            slug: 'account',
            fields: {
              name: {
                type: 'string',
                computedAs: {
                  kind: 'VIRTUAL',
                  value: {
                    __RONIN_EXPRESSION: "(__RONIN_FIELD_name || 'World')",
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(createQuery).toMatchObject(finalQuery);
  });

  test('using multiple fields with expressions', () => {
    let setQuery: Query | undefined;

    const setProxy = getSyntaxProxy<SetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.set`,
      callback: (value) => {
        setQuery = value;
      },
    });

    setProxy.accounts.to((f: Record<string, unknown>) => ({
      name: concat(f.firstName, ' ', f.lastName),
      email: concat(f.handle, '@site.co'),
      handle: 'newHandle',
    }));

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        set: {
          accounts: {
            to: {
              name: {
                [QUERY_SYMBOLS.EXPRESSION]: `concat(${QUERY_SYMBOLS.FIELD}firstName, ' ', ${QUERY_SYMBOLS.FIELD}lastName)`,
              },
              email: {
                [QUERY_SYMBOLS.EXPRESSION]: `concat(${QUERY_SYMBOLS.FIELD}handle, '@site.co')`,
              },
              handle: 'newHandle',
            },
          },
        },
      },
    };

    expect(setQuery).toMatchObject(finalQuery);
  });

  test('using queries in batch', () => {
    const getProxy = getSyntaxProxy<GetQuery>({ root: `${QUERY_SYMBOLS.QUERY}.get` });

    const queries = getBatchProxy(() => [getProxy.account()]);

    expect(queries.length === 1 ? { result: true } : null).toMatchObject({
      result: true,
    });

    expectTypeOf(queries).toEqualTypeOf<Array<SyntaxItem<Query>>>();
  });

  test('using queries with placeholder in batch', () => {
    const getProxy = getSyntaxProxy<GetQuery>({ root: `${QUERY_SYMBOLS.QUERY}.get` });

    const queries = getBatchProxy(() => [
      getProxy.account(),
      null as unknown as SyntaxItem<Query>,
      getProxy.team(),
    ]);

    expect(queries).toMatchObject([
      {
        structure: {
          get: {
            account: {},
          },
        },
      },
      {
        structure: null,
      },
      {
        structure: {
          get: {
            team: {},
          },
        },
      },
    ]);

    expectTypeOf(queries).toEqualTypeOf<Array<SyntaxItem<Query>>>();
  });

  test('using options for query in batch', () => {
    const getProxy = getSyntaxProxy<GetQuery>({ root: `${QUERY_SYMBOLS.QUERY}.get` });

    const queryList = getBatchProxy(() => [
      getProxy.account(
        {
          with: { handle: 'juri' },
        },
        { randomOption: true },
      ),
    ]);

    expect(queryList).toEqual([
      {
        structure: {
          get: {
            account: {
              with: {
                handle: 'juri',
              },
            },
          },
        },
        options: {
          randomOption: true,
        },
      },
    ]);

    expectTypeOf(queryList).toEqualTypeOf<Array<SyntaxItem<Query>>>();
  });

  test('using function chaining in batch', () => {
    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: () => undefined,
    });

    const queryList = getBatchProxy(() => [
      // Test queries where the second function is called right after the first one.
      getProxy.members
        .with({ team: 'red' })
        .selecting(['name']),
      // Test queries where the second function is not called right after the first one.
      getProxy.members
        .with({ team: 'blue' })
        // @ts-expect-error This will be improved shortly.
        .orderedBy.ascending(['joinedAt']),
    ]);

    expect(queryList).toEqual([
      {
        structure: {
          get: {
            members: {
              with: {
                team: 'red',
              },
              selecting: ['name'],
            },
          },
        },
      },
      {
        structure: {
          get: {
            members: {
              with: {
                team: 'blue',
              },
              orderedBy: {
                ascending: ['joinedAt'],
              },
            },
          },
        },
      },
    ]);

    expectTypeOf(queryList).toEqualTypeOf<Array<SyntaxItem<Query>>>();
  });

  // Ensure that the batch context is correctly reset, even in the case that one of the
  // operations inside the batch throws an error.
  test('using individual queries after batch that throws', () => {
    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: () => ({
        email: 'elaine@site.co',
      }),
    });

    try {
      getBatchProxy(() => {
        throw new Error('Test error');
      });
    } catch (_err) {
      // Ignore the error.
    }

    const result = getProxy.account();

    expect(result).toMatchObject({
      email: 'elaine@site.co',
    });
  });

  test('using nested function as argument in batch', () => {
    // It's important to define the `callback` here, in order to guarantee that the
    // queries are executed standalone if no batch context is detected.
    const callback = () => undefined;

    const addProxy = getSyntaxProxy<AddQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.add`,
      callback,
    });
    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback,
    });
    const alterProxy = getSyntaxProxy<
      AlterQuery,
      Model | ModelField | ModelIndex | ModelPreset
    >({ root: `${QUERY_SYMBOLS.QUERY}.alter`, callback });

    const queryList = getBatchProxy(() => [
      addProxy.newUsers.with(() => getProxy.oldUsers()),
      // Assert whether function chaining is still possible after a nested function call,
      // since the latter is able to manipulate the batch context.
      alterProxy
        .model('newUsers')
        .to({ slug: 'accounts' }),
    ]);

    expect(queryList).toEqual([
      {
        structure: {
          add: {
            newUsers: {
              with: {
                __RONIN_QUERY: {
                  get: { oldUsers: {} },
                },
              },
            },
          },
        },
      },
      {
        structure: {
          alter: {
            model: 'newUsers',
            to: {
              slug: 'accounts',
            },
          },
        },
      },
    ]);

    expectTypeOf(queryList).toEqualTypeOf<Array<SyntaxItem<Query>>>();
  });

  test('using schema query types', () => {
    const callback = () => undefined;

    const createProxy = getSyntaxProxy<CreateQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.create`,
      callback,
    });
    const alterProxy = getSyntaxProxy<
      AlterQuery,
      Model | ModelField | ModelIndex | ModelPreset
    >({ root: `${QUERY_SYMBOLS.QUERY}.alter`, callback });
    const dropProxy = getSyntaxProxy<DropQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.drop`,
      callback,
    });

    const queryList = getBatchProxy(() => [
      createProxy.model({
        slug: 'account',
      }),
      alterProxy.model('account').to({
        slug: 'users',
      }),
      alterProxy
        .model('users')
        // @ts-expect-error This will be improved shortly.
        .create.field({
          slug: 'handle',
        }),
      alterProxy
        .model('users')
        // @ts-expect-error This will be improved shortly.
        .alter.field('handle')
        .to({
          name: 'User Handle',
        }),
      alterProxy
        .model('users')
        // @ts-expect-error This will be improved shortly
        .drop.field('handle'),
      dropProxy.model('users'),
    ]);

    expect(queryList).toEqual([
      {
        structure: {
          create: {
            model: {
              slug: 'account',
            },
          },
        },
      },
      {
        structure: {
          alter: {
            model: 'account',
            to: {
              slug: 'users',
            },
          },
        },
      },
      {
        structure: {
          alter: {
            create: {
              field: {
                slug: 'handle',
              },
            },
            model: 'users',
          },
        },
      },
      {
        structure: {
          alter: {
            alter: {
              field: 'handle',
              to: {
                name: 'User Handle',
              },
            },
            model: 'users',
          },
        },
      },
      {
        structure: {
          alter: {
            drop: {
              field: 'handle',
            },
            model: 'users',
          },
        },
      },
      {
        structure: {
          drop: {
            model: 'users',
          },
        },
      },
    ]);

    expectTypeOf(queryList).toEqualTypeOf<Array<SyntaxItem<Query>>>();
  });

  test('using a function call at the root', () => {
    let getQuery: Query | undefined;

    const getProxy = getSyntaxProxy<GetQuery>({
      root: `${QUERY_SYMBOLS.QUERY}.get`,
      callback: (value) => {
        getQuery = value;
      },
    });

    getProxy({ account: null });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        get: {
          account: null,
        },
      },
    };

    expect(getQuery).toMatchObject(finalQuery);
  });

  test('creating a model via query using primitive helpers', () => {
    let createQuery: Query | undefined;

    const createProxy = getSyntaxProxy<CreateQuery, Model>({
      root: `${QUERY_SYMBOLS.QUERY}.create`,
      callback: (value) => {
        createQuery = value;
      },
    });

    createProxy.model({
      slug: 'account',

      fields: {
        handle: string().required(),
      } as any,
    });

    const finalQuery = {
      [QUERY_SYMBOLS.QUERY]: {
        create: {
          model: {
            slug: 'account',
            fields: {
              handle: {
                type: 'string',
                required: true,
              },
            },
          },
        },
      },
    };

    expect(createQuery).toMatchObject(finalQuery);
  });
});
