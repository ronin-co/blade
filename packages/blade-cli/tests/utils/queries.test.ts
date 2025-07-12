import { describe, expect, test } from 'bun:test';
import {
  createFieldQuery,
  createIndexQuery,
  createModelQuery,
  createTempColumnQuery,
  createTempModelQuery,
  dropFieldQuery,
  dropIndexQuery,
  dropModelQuery,
  renameFieldQuery,
  renameModelQuery,
  setFieldQuery,
} from '@/src/utils/queries';
import type { Model, ModelField } from 'blade-compiler';

describe('queries', () => {
  test('drop model query', () => {
    const result = dropModelQuery('user');
    expect(result).toBe('drop.model("user")');
  });

  test('create model query without properties', () => {
    const user: Model = {
      slug: 'user',
    };
    const result = createModelQuery(user);
    expect(result).toBe('create.model({"slug":"user"})');
  });

  test('create model query with properties', () => {
    const user: Model = {
      slug: 'user',
      pluralSlug: 'users',
      name: 'User',
      pluralName: 'Users',
      fields: {
        username: {
          type: 'string',
          name: 'Username',
          unique: true,
          required: true,
        },
      },
    };
    const result = createModelQuery(user);
    expect(result).toBe(
      'create.model({"slug":"user","pluralSlug":"users","name":"User","pluralName":"Users","fields":{"username":{"type":"string","name":"Username","unique":true,"required":true}}})',
    );
  });

  test('create field query for non-link field', () => {
    const field: ModelField = {
      slug: 'username',
      type: 'string',
      name: 'Username',
      unique: true,
      required: true,
    };
    const result = createFieldQuery('user', field);
    expect(result).toBe(`alter.model('user').create.field(${JSON.stringify(field)})`);
  });

  test('create field query for link field', () => {
    const field: ModelField = {
      slug: 'profile',
      type: 'link',
      name: 'Profile',
      target: 'profile',
    };
    const result = createFieldQuery('user', field);
    expect(result).toBe(`alter.model('user').create.field(${JSON.stringify(field)})`);
  });

  test('create field query for link field', () => {
    const field: ModelField = {
      slug: 'profile',
      type: 'link',
      name: 'Profile',
      target: 'profile',
    };
    const result = createFieldQuery('user', field);
    expect(result).toBe(`alter.model('user').create.field(${JSON.stringify(field)})`);
  });

  test('set field query', () => {
    const result = setFieldQuery('user', 'username', { unique: true });
    expect(result).toBe(
      'alter.model("user").alter.field("username").to({"unique":true})',
    );
  });

  test('drop field query', () => {
    const result = dropFieldQuery('user', 'username');
    expect(result).toBe('alter.model("user").drop.field("username")');
  });

  test('create temp model query', () => {
    const result = createTempModelQuery(
      {
        slug: 'user',
        fields: {
          username: {
            type: 'string',
            name: 'Username',
            unique: true,
            required: true,
          },
        },
      },
      { name: 'User', pluralName: 'Users', pluralSlug: 'users' },
    );
    expect(result).toEqual([
      'create.model({"slug":"RONIN_TEMP_user","fields":{"username":{"type":"string","name":"Username","unique":true,"required":true}},"idPrefix":"use"})',
      'add.RONIN_TEMP_users.with(() => get.users())',
      'drop.model("user")',
      'alter.model("RONIN_TEMP_user").to({slug: "user", name: "User", pluralName: "Users"})',
    ]);
  });

  test('create temp model query with custom queries', () => {
    const customQueries: Array<string> = ['get.model("user")'];
    const result = createTempModelQuery(
      {
        slug: 'user',
        fields: {
          username: {
            type: 'string',
            name: 'Username',
            unique: true,
            required: true,
          },
        },
      },
      { customQueries, name: 'User', pluralName: 'Users', pluralSlug: 'users' },
    );
    expect(result).toEqual([
      'create.model({"slug":"RONIN_TEMP_user","fields":{"username":{"type":"string","name":"Username","unique":true,"required":true}},"idPrefix":"use"})',
      'add.RONIN_TEMP_users.with(() => get.users())',
      ...customQueries,
      'drop.model("user")',
      'alter.model("RONIN_TEMP_user").to({slug: "user", name: "User", pluralName: "Users"})',
    ]);
  });

  test('rename model query', () => {
    const result = renameModelQuery('user', 'account');
    expect(result).toBe('alter.model("user").to({slug: "account"})');
  });

  test('rename field query', () => {
    const result = renameFieldQuery('user', 'email', 'emailAddress');
    expect(result).toBe(
      'alter.model("user").alter.field("email").to({slug: "emailAddress"})',
    );
  });

  test('add index query', () => {
    const result = createIndexQuery('user', {
      slug: 'test',
      fields: [{ slug: 'email' }],
      unique: true,
    });

    expect(result).toBe(
      'alter.model("user").create.index({"slug":"test","fields":[{"slug":"email"}],"unique":true})',
    );
  });

  test('drop index query', () => {
    const result = dropIndexQuery('user', 'emailIndex');
    expect(result).toBe('alter.model("user").drop.index("emailIndex")');
  });

  test('create temp column query', () => {
    const result = createTempColumnQuery(
      'user',
      'users',
      {
        slug: 'username',
        type: 'string',
        name: 'Username',
        unique: true,
        required: true,
      },
      [],
    );
    expect(result).toEqual([
      `alter.model('user').create.field({"slug":"RONIN_TEMP_username","type":"string","name":"Username","unique":true,"required":true})`,
      'set.users.to.RONIN_TEMP_username(f => f.username)',
      'alter.model("user").drop.field("username")',
      'alter.model("user").alter.field("RONIN_TEMP_username").to({slug: "username"})',
    ]);
  });

  test('create temp column query with dot notation', () => {
    const result = createTempColumnQuery(
      'user',
      'users',
      {
        slug: 'profile.username',
        type: 'string',
        name: 'Username',
        unique: true,
        required: true,
      },
      [],
    );
    expect(result).toEqual([
      'alter.model(\'user\').create.field({"slug":"RONIN_TEMP_profile.username","type":"string","name":"Username","unique":true,"required":true})',
      'set.users.to["RONIN_TEMP_profile.username"](f => f["profile.username"])',
      'alter.model("user").drop.field("profile.username")',
      'alter.model("user").alter.field("RONIN_TEMP_profile.username").to({slug: "profile.username"})',
    ]);
  });
});
