import { afterAll, describe, expect, test } from 'bun:test';

import { TEST_USER, cleanup, init } from '@/fixtures/utils';
import { ronin } from '@/index';

describe('adapter', () => {
  afterAll(async () => {
    await cleanup();
  });

  describe('authentication', () => {
    test('with no `RONIN_TOKEN` set', async () => {
      // biome-ignore lint/nursery/noProcessEnv: We're intentionally overriding this environment variable.
      process.env.RONIN_TOKEN = undefined;

      const { auth } = await init({
        betterAuth: {
          database: ronin(),
        },
      });

      const signUp = async (): Promise<void> => {
        await auth.api.signUpEmail({ body: TEST_USER });
      };

      expect(signUp).toThrow(
        'Please specify the `RONIN_TOKEN` environment variable or set the `token` option when invoking RONIN.',
      );
    });

    test('with an invalid `RONIN_TOKEN`', async () => {
      // biome-ignore lint/nursery/noProcessEnv: We're intentionally overriding this environment variable.
      process.env.RONIN_TOKEN = 'abc123';

      const { auth } = await init({
        betterAuth: {
          database: ronin(),
        },
      });

      const signUp = async (): Promise<void> => {
        await auth.api.signUpEmail({ body: TEST_USER });
      };

      expect(signUp).toThrow('Invalid `Authorization` header: Must be a valid JWT.');
    });

    test('with a valid mock `RONIN_TOKEN`', async () => {
      const MOCK_JWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIiLCJleHAiOjAsImlhdCI6MCwiaXNzIjoiIiwic3ViIjoiIiwidGtuIjoiIn0.QwdhNGPGS1Rt3se0yBYi6XJLOPEg4cSNdBUjd8EOXaQ';

      // biome-ignore lint/nursery/noProcessEnv: We're intentionally overriding this environment variable.
      process.env.RONIN_TOKEN = MOCK_JWT;

      const { auth } = await init({
        betterAuth: {
          database: ronin(),
        },
      });

      const signUp = async (): Promise<void> => {
        await auth.api.signUpEmail({ body: TEST_USER });
      };

      expect(signUp).toThrow(
        'This app has been deleted. Please create a new app in the dashboard.',
      );
    });
  });

  describe('api', () => {
    test('sign up a new user', async () => {
      const { auth } = await init();

      const user = await auth.api.signUpEmail({ body: TEST_USER });

      expect(user).toBeDefined();
      expect(user).toMatchObject({
        token: expect.any(String),
        user: {
          createdAt: expect.any(Date),
          email: expect.any(String),
          emailVerified: false,
          id: expect.any(String),
          image: null,
          name: TEST_USER.name,
          updatedAt: expect.any(Date),
        },
      });
    });

    test('sign in an existing user', async () => {
      const { auth } = await init();

      await auth.api.signUpEmail({ body: TEST_USER });

      const user = await auth.api.signInEmail({
        body: TEST_USER,
      });

      expect(user).toBeDefined();
      expect(user).toMatchObject({
        redirect: false,
        token: expect.any(String),
        url: undefined,
        user: {
          createdAt: expect.any(Date),
          email: expect.any(String),
          emailVerified: false,
          id: expect.any(String),
          image: null,
          name: TEST_USER.name,
          updatedAt: expect.any(Date),
        },
      });
    });

    test('get a session', async () => {
      const { auth } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      const session = await auth.api.getSession({
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(session).toBeDefined();
      expect(session).toMatchObject({
        session: {
          id: expect.any(String),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          expiresAt: expect.any(Date),
          ipAddress: '',
          token: expect.any(String),
          userId: expect.any(String),
          userAgent: '',
        },
        user: {
          id: expect.any(String),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          email: TEST_USER.email,
          emailVerified: false,
          image: null,
          name: TEST_USER.name,
        },
      });
    });

    test('revoke a session', async () => {
      const { auth } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      const session = await auth.api.revokeSession({
        body: {
          token: token as string,
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(session).toBeDefined();
      expect(session).toMatchObject({
        status: true,
      });
    });

    test('change email address', async () => {
      const { auth } = await init({
        betterAuth: {
          user: {
            changeEmail: {
              enabled: true,
            },
          },
        },
      });

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const result = await auth.api.changeEmail({
        body: {
          newEmail: 'test@example.com',
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        status: true,
      });
    });

    test('change password', async () => {
      const { auth } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const result = await auth.api.changePassword({
        body: {
          currentPassword: TEST_USER.password,
          newPassword: 'newpassword',
          revokeOtherSessions: true,
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        token: expect.any(String),
        user: {
          createdAt: expect.any(Date),
          email: TEST_USER.email,
          emailVerified: false,
          id: expect.any(String),
          image: null,
          name: TEST_USER.name,
          updatedAt: expect.any(Date),
        },
      });
    });

    test('delete user', async () => {
      const { auth } = await init({
        betterAuth: {
          user: {
            deleteUser: {
              enabled: true,
            },
          },
        },
      });

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const result = await auth.api.deleteUser({
        body: {
          password: TEST_USER.password,
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        message: 'User deleted',
        success: true,
      });
    });

    test('forget password', async () => {
      let enabledReset = false;

      const { auth } = await init({
        betterAuth: {
          emailAndPassword: {
            enabled: true,
            // biome-ignore lint/suspicious/useAwait: Better Auth requires this to be asynchronous.
            sendResetPassword: async (): Promise<void> => {
              enabledReset = true;
            },
          },
        },
      });

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const result = await auth.api.forgetPassword({
        body: {
          email: TEST_USER.email,
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');
      expect(token).not.toBeNull();

      expect(enabledReset).toBe(true);

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        status: true,
      });
    });

    test('list sessions', async () => {
      const { auth } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const sessions = await auth.api.listSessions({
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(sessions).toBeDefined();
      expect(sessions).toBeArray();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date),
        id: expect.any(String),
        ipAddress: '',
        token: expect.any(String),
        updatedAt: expect.any(Date),
        userAgent: '',
        userId: expect.any(String),
      });
    });

    test('list user accounts', async () => {
      const { auth } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const accounts = await auth.api.listUserAccounts({
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(accounts).toBeDefined();
      expect(accounts).toBeArray();
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        accountId: expect.any(String),
        createdAt: expect.any(Date),
        id: expect.any(String),
        provider: 'credential',
        scopes: [],
        updatedAt: expect.any(Date),
      });
    });

    test('revoke other sessions', async () => {
      const { auth } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const result = await auth.api.revokeOtherSessions({
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        status: true,
      });
    });

    test('revoke a session', async () => {
      const { auth, client } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const result = await auth.api.revokeSession({
        body: {
          token: token as string,
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      const sessions = await client.get.sessions();

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        status: true,
      });

      expect(sessions).toBeDefined();
      expect(sessions).toBeArray();
      expect(sessions).toHaveLength(0);
    });

    test('revoke all sessions', async () => {
      const { auth, client } = await init();

      const { token } = await auth.api.signUpEmail({ body: TEST_USER });

      const result = await auth.api.revokeSessions({
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      const sessions = await client.get.sessions();

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        status: true,
      });

      expect(sessions).toBeDefined();
      expect(sessions).toBeArray();
      expect(sessions).toHaveLength(0);
    });

    test('update a user', async () => {
      const { auth, client } = await init();

      const { token, user } = await auth.api.signUpEmail({ body: TEST_USER });

      const newName = 'John Doe';

      const result = await auth.api.updateUser({
        body: {
          name: newName,
        },
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      });

      const updatedUser = await client.get.user.with.id(user.id);

      expect(token).toBeDefined();
      expect(token).toBeTypeOf('string');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        status: true,
      });

      expect(user.name).toBe(TEST_USER.name);

      expect(updatedUser).toBeDefined();
      expect(updatedUser).toMatchObject({
        email: TEST_USER.email,
        emailVerified: false,
        id: user.id,
        image: null,
        name: newName,
        ronin: {
          createdAt: expect.any(Date),
          createdBy: null,
          updatedAt: expect.any(Date),
          updatedBy: null,
        },
      });
    });
  });

  test('count users', async () => {
    const { auth, client } = await init();
    const adapter = ronin(client);

    await auth.api.signUpEmail({ body: TEST_USER });

    // TODO(@nurodev): This mock data is entirely made up & could be wrong.
    // I need to find a real-world use that calls `updateMany` to test this.
    const numUsers = await adapter(auth.options).count({
      model: 'user',
      where: [
        {
          field: 'email',
          value: TEST_USER.email,
        },
      ],
    });

    expect(numUsers).toBeDefined();
    expect(numUsers).toBeTypeOf('number');
    expect(numUsers).toBe(1);
  });

  test('update many users', async () => {
    const { auth, client } = await init();
    const adapter = ronin(client);

    await auth.api.signUpEmail({ body: TEST_USER });

    // TODO(@nurodev): This mock data is entirely made up & could be wrong.
    // I need to find a real-world use that calls `updateMany` to test this.
    const numChangedRecords = await adapter(auth.options).updateMany({
      model: 'user',
      update: {
        email: 'test@example.com',
      },
      where: [
        {
          field: 'email',
          value: TEST_USER.email,
        },
      ],
    });

    expect(numChangedRecords).toBeDefined();
    expect(numChangedRecords).toBeTypeOf('number');
    expect(numChangedRecords).toBe(1);
  });
});
