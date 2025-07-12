import { afterAll, describe, expect, test } from 'bun:test';

import { TEST_USER } from '@/fixtures/utils';
import { cleanup, init } from '@/fixtures/utils';
import {
  convertWhereClause,
  getModel,
  operatorToAssertion,
  transformInput,
  transformOrderedBy,
  transformOutput,
} from '@/transform';

import type { Where } from 'better-auth';

const EXAMPLE_IMAGE_PATH = new URL('./fixtures/example.jpeg', import.meta.url);

describe('transform', () => {
  afterAll(async () => {
    await cleanup();
  });

  describe('operatorToAssertion', () => {
    test('contains', () => {
      const result = operatorToAssertion('contains', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ containing: 'foobar' });
    });
    test('ends_with', () => {
      const result = operatorToAssertion('ends_with', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ endingWith: 'foobar' });
    });
    test('eq', () => {
      const result = operatorToAssertion('eq', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ being: 'foobar' });
    });
    test('gt', () => {
      const result = operatorToAssertion('gt', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ greaterThan: 'foobar' });
    });
    test('gte', () => {
      const result = operatorToAssertion('gte', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ greaterOrEqual: 'foobar' });
    });
    test('lt', () => {
      const result = operatorToAssertion('lt', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ lessThan: 'foobar' });
    });
    test('lte', () => {
      const result = operatorToAssertion('lte', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ lessOrEqual: 'foobar' });
    });
    test('ne', () => {
      const result = operatorToAssertion('ne', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ notBeing: 'foobar' });
    });
    test('starts_with', () => {
      const result = operatorToAssertion('starts_with', 'foobar');
      expect(result).toBeDefined();
      expect(result).toMatchObject({ startingWith: 'foobar' });
    });
    test('invalid operator', () => {
      const result = operatorToAssertion('invalid_operator', 'foobar');
      expect(result).toBeDefined();
      expect(result).toBeTypeOf('string');
      expect(result).toBe('foobar');
    });
  });

  describe('convertWhereClause', () => {
    test('with no statements', () => {
      const converted = convertWhereClause([]);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({});
    });

    test('with a single empty statements', () => {
      const converted = convertWhereClause([
        // @ts-expect-error `null` is not allowed as an array element
        null,
      ]);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({});
    });

    test('with a basic query', () => {
      const where = [
        {
          field: 'email',
          value: TEST_USER.email,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({
        email: TEST_USER.email,
      });
    });

    test('with a basic equals query', () => {
      const where = [
        {
          field: 'email',
          operator: 'eq',
          value: TEST_USER.email,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({
        email: TEST_USER.email,
      });
    });

    test('with a basic contains query', () => {
      const where = [
        {
          field: 'email',
          operator: 'contains',
          value: TEST_USER.email,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({
        email: {
          containing: TEST_USER.email,
        },
      });
    });

    test('with a multiple AND queries', () => {
      const where = [
        {
          field: 'email',
          value: TEST_USER.email,
        },
        {
          field: 'name',
          value: TEST_USER.name,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({
        email: TEST_USER.email,
        name: TEST_USER.name,
      });
    });

    test('with a multiple AND queries', () => {
      const where = [
        {
          field: 'email',
          operator: 'eq',
          value: TEST_USER.email,
        },
        {
          field: 'name',
          operator: 'eq',
          value: TEST_USER.name,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({
        email: TEST_USER.email,
        name: TEST_USER.name,
      });
    });

    test('with a multiple AND queries', () => {
      const where = [
        {
          field: 'email',
          operator: 'contains',
          value: TEST_USER.email,
        },
        {
          field: 'name',
          operator: 'contains',
          value: TEST_USER.name,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject({
        email: {
          containing: TEST_USER.email,
        },
        name: {
          containing: TEST_USER.name,
        },
      });
    });

    test('with a multiple OR queries', () => {
      const where = [
        {
          connector: 'OR',
          field: 'email',
          value: TEST_USER.email,
        },
        {
          connector: 'OR',
          field: 'name',
          value: TEST_USER.name,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject([
        {
          email: TEST_USER.email,
        },
        {
          name: TEST_USER.name,
        },
      ]);
    });

    test('with a multiple equals OR queries', () => {
      const where = [
        {
          connector: 'OR',
          field: 'email',
          operator: 'eq',
          value: TEST_USER.email,
        },
        {
          connector: 'OR',
          field: 'name',
          operator: 'eq',
          value: TEST_USER.name,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject([
        {
          email: TEST_USER.email,
        },
        {
          name: TEST_USER.name,
        },
      ]);
    });

    test('with a multiple contains OR queries', () => {
      const where = [
        {
          connector: 'OR',
          field: 'email',
          operator: 'contains',
          value: TEST_USER.email,
        },
        {
          connector: 'OR',
          field: 'name',
          operator: 'contains',
          value: TEST_USER.name,
        },
      ] satisfies Array<Where>;
      const converted = convertWhereClause(where);

      expect(converted).toBeDefined();
      expect(converted).toMatchObject([
        {
          email: {
            containing: TEST_USER.email,
          },
        },
        {
          name: {
            containing: TEST_USER.name,
          },
        },
      ]);
    });
  });

  describe('getModel', () => {
    test('a basic model', async () => {
      const { client } = await init();

      const model = await getModel(client, 'account');

      expect(model).toBeDefined();
      expect(model).toMatchObject({
        slug: 'account',
        pluralSlug: 'accounts',
        fields: expect.any(Object),
      });
    });

    test("a model that doesn't exist", async () => {
      const { client } = await init();

      const getBrokenModel = async (): Promise<void> => {
        await getModel(client, 'foobar');
      };

      expect(getBrokenModel).toThrowError('Failed to resolve model');
    });

    test('a model with no `pluralSlug`', async () => {
      const { client, database } = await init();

      await database.query([
        "UPDATE ronin_schema SET pluralSlug = NULL WHERE slug = 'account';",
      ]);

      const getBrokenModel = async (): Promise<void> => {
        await getModel(client, 'account');
      };

      expect(getBrokenModel).toThrowError('Invalid RONIN model');
    });
  });

  describe('transformInput', () => {
    describe('for a create', () => {
      test('`account` query', async () => {
        const instructions = {
          accountId: 'usr_1234',
          createdAt: new Date(),
          password: TEST_USER.password,
          providerId: 'credential',
          updatedAt: new Date(),
          userId: 'usr_1234',
        };

        const transformed = await transformInput(instructions, 'account');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          accountId: instructions.accountId,
          password: instructions.password,
          providerId: instructions.providerId,
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
          userId: instructions.userId,
        });
      });

      test('`session` query', async () => {
        const instructions = {
          createdAt: new Date(),
          expiresAt: new Date(),
          ipAddress: '',
          token: Math.random().toString(36).substring(7),
          updatedAt: new Date(),
          userAgent: '',
          userId: 'usr_1234',
        };

        const transformed = await transformInput(instructions, 'session');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          expiresAt: instructions.expiresAt,
          ipAddress: '',
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
          token: instructions.token,
          userId: instructions.userId,
          userAgent: '',
        });
      });

      test('`user` query', async () => {
        const instructions = {
          createdAt: new Date(),
          email: TEST_USER.email,
          emailVerified: false,
          image: undefined,
          name: TEST_USER.name,
          updatedAt: new Date(),
        };

        const transformed = await transformInput(instructions, 'user');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          email: TEST_USER.email,
          emailVerified: false,
          image: undefined,
          name: TEST_USER.name,
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
        });
      });

      test('`user` query with a `null` image', async () => {
        const instructions = {
          createdAt: new Date(),
          email: TEST_USER.email,
          emailVerified: false,
          image: null,
          name: TEST_USER.name,
          updatedAt: new Date(),
        };

        const transformed = await transformInput(instructions, 'user');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          email: TEST_USER.email,
          emailVerified: false,
          image: null,
          name: TEST_USER.name,
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
        });
      });

      test('`user` query with a `Uint8Array` image', async () => {
        const image = await Bun.file(EXAMPLE_IMAGE_PATH.pathname).bytes();

        const instructions = {
          createdAt: new Date(),
          email: TEST_USER.email,
          emailVerified: false,
          image,
          name: TEST_USER.name,
          updatedAt: new Date(),
        };

        const transformed = await transformInput(instructions, 'user');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          email: TEST_USER.email,
          emailVerified: false,
          image: expect.any(Uint8Array),
          name: TEST_USER.name,
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
        });
      });

      test('`user` query with a `ArrayBuffer` image', async () => {
        const image = await Bun.file(EXAMPLE_IMAGE_PATH.pathname).arrayBuffer();

        const instructions = {
          createdAt: new Date(),
          email: TEST_USER.email,
          emailVerified: false,
          image,
          name: TEST_USER.name,
          updatedAt: new Date(),
        };

        const transformed = await transformInput(instructions, 'user');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          email: TEST_USER.email,
          emailVerified: false,
          image: expect.any(ArrayBuffer),
          name: TEST_USER.name,
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
        });
      });

      test('`user` query with a `File` image', async () => {
        const image = await Bun.file(EXAMPLE_IMAGE_PATH.pathname).arrayBuffer();
        const file = new File([image], 'example.jpeg');

        const instructions = {
          createdAt: new Date(),
          email: TEST_USER.email,
          emailVerified: false,
          image: file,
          name: TEST_USER.name,
          updatedAt: new Date(),
        };

        const transformed = await transformInput(instructions, 'user');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          email: TEST_USER.email,
          emailVerified: false,
          image: expect.any(File),
          name: TEST_USER.name,
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
        });
      });

      test('`user` query with an image url', async () => {
        const image = await Bun.file(EXAMPLE_IMAGE_PATH.pathname).bytes();

        const server = Bun.serve({
          routes: {
            '/': new Response(image, {
              headers: {
                'Content-Disposition': 'inline; filename="example.jpeg"',
                'Content-Length': image.byteLength.toString(),
                'Content-Type': 'image/jpeg',
              },
            }),
          },
        });

        const instructions = {
          createdAt: new Date(),
          email: TEST_USER.email,
          emailVerified: false,
          image: new URL('/', server.url.href).href,
          name: TEST_USER.name,
          updatedAt: new Date(),
        };

        const transformed = await transformInput(instructions, 'user');

        await server.stop();

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          email: TEST_USER.email,
          emailVerified: false,
          image: expect.any(Blob),
          name: TEST_USER.name,
          ronin: {
            createdAt: instructions.createdAt,
            updatedAt: instructions.updatedAt,
          },
        });
      });

      test('`verification` query', async () => {
        const instructions = {
          expiresAt: new Date(),
          identifier: Math.random().toString(36).substring(7),
          value: Math.random().toString(36).substring(7),
        };

        const transformed = await transformInput(instructions, 'verification');

        expect(transformed).toBeDefined();
        expect(transformed).toMatchObject({
          expiresAt: instructions.expiresAt,
          identifier: instructions.identifier,
          value: instructions.value,
        });
      });
    });

    test('for multiple inputs', async () => {
      const instruction = {
        accountId: 'usr_1234',
        createdAt: new Date(),
        password: TEST_USER.password,
        providerId: 'credential',
        updatedAt: new Date(),
        userId: 'usr_1234',
      };

      const transformed = await transformInput([instruction], 'account');

      expect(transformed).toBeDefined();
      expect(transformed).toBeArray();
      expect(transformed).toMatchObject([
        {
          accountId: instruction.accountId,
          password: instruction.password,
          providerId: instruction.providerId,
          ronin: {
            createdAt: instruction.createdAt,
            updatedAt: instruction.updatedAt,
          },
          userId: instruction.userId,
        },
      ]);
    });

    // TODO(@nurodev): Add unit tests for all other query types
  });

  describe('transformOrderedBy', () => {
    test('an no `sortBy` object', () => {
      const result = transformOrderedBy();

      expect(result).toBeUndefined();
    });

    test('a basic ascending query', () => {
      const result = transformOrderedBy({
        direction: 'asc',
        field: 'email',
      });

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        ascending: ['email'],
      });
    });

    test('a basic descending query', () => {
      const result = transformOrderedBy({
        direction: 'desc',
        field: 'email',
      });

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        descending: ['email'],
      });
    });

    test('am ascending query with `createdAt`', () => {
      const result = transformOrderedBy({
        direction: 'asc',
        field: 'createdAt',
      });

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        ascending: ['ronin.createdAt'],
      });
    });

    test('am ascending query with `updatedAt`', () => {
      const result = transformOrderedBy({
        direction: 'asc',
        field: 'updatedAt',
      });

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        ascending: ['ronin.updatedAt'],
      });
    });
  });

  describe('transformOutput', () => {
    test('with `null` data', () => {
      const transformed = transformOutput(null);
      expect(transformed).toBeDefined();
      expect(transformed).toBe(null);
    });

    test('with an account record', async () => {
      const { auth, client } = await init();

      const { user } = await auth.api.signUpEmail({ body: TEST_USER });
      const account = await client.get.account.with.userId(user.id);
      const transformed = transformOutput(account);

      expect(account).toBeDefined();
      expect(account).toMatchObject({
        id: expect.any(String),
        ronin: {
          createdAt: expect.any(Date),
          createdBy: null,
          updatedAt: expect.any(Date),
          updatedBy: null,
        },
        accessToken: null,
        accessTokenExpiresAt: null,
        accountId: expect.any(String),
        idToken: null,
        password: expect.any(String),
        providerId: 'credential',
        refreshToken: null,
        refreshTokenExpiresAt: null,
        scope: null,
        userId: expect.any(String),
      });

      expect(transformed).toBeDefined();
      expect(transformed).toMatchObject({
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        accessToken: null,
        accessTokenExpiresAt: null,
        accountId: expect.any(String),
        idToken: null,
        password: expect.any(String),
        providerId: 'credential',
        refreshToken: null,
        refreshTokenExpiresAt: null,
        scope: null,
        userId: expect.any(String),
      });
    });

    test('with a session record', async () => {
      const { auth, client } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });
      const session = await client.get.session.with.token(token as string);
      const transformed = transformOutput(session);

      expect(session).toBeDefined();
      expect(session).toMatchObject({
        id: expect.any(String),
        ronin: {
          createdAt: expect.any(Date),
          createdBy: null,
          updatedAt: expect.any(Date),
          updatedBy: null,
        },
        expiresAt: expect.any(Date),
        ipAddress: '',
        token: expect.any(String),
        userId: expect.any(String),
        userAgent: '',
      });

      expect(transformed).toBeDefined();
      expect(transformed).toMatchObject({
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        ipAddress: '',
        token: expect.any(String),
        userId: expect.any(String),
        userAgent: '',
      });
    });

    test('with a user record', async () => {
      const { auth, client } = await init();

      const signUp = await auth.api.signUpEmail({ body: TEST_USER });
      const user = await client.get.user.with.id(signUp.user.id);
      const transformed = transformOutput(user);

      expect(user).toBeDefined();
      expect(user).toMatchObject({
        id: expect.any(String),
        ronin: {
          createdAt: expect.any(Date),
          createdBy: null,
          updatedAt: expect.any(Date),
          updatedBy: null,
        },
        email: TEST_USER.email,
        emailVerified: false,
        image: null,
        name: TEST_USER.name,
      });

      expect(transformed).toBeDefined();
      expect(transformed).toMatchObject({
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        email: TEST_USER.email,
        emailVerified: false,
        image: null,
        name: TEST_USER.name,
      });
    });

    // TODO(@nurodev): Add `verification` test

    test('with an unknown record', () => {
      const transformed = transformOutput({
        id: 'usr_1234',
        ronin: {
          createdAt: new Date(),
          createdBy: null,
          updatedAt: new Date(),
          updatedBy: null,
        },
      });

      expect(transformed).toBeDefined();
      expect(transformed).toMatchObject({
        id: 'usr_1234',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});
