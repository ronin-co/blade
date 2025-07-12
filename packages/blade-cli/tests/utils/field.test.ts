import { describe, expect, test } from 'bun:test';
import { CompareModels } from '@/src/utils/field';
import type { ModelWithFieldsArray } from '@/src/utils/model';
import type { ModelField } from 'blade-compiler';

describe('fields', () => {
  describe('fields are different', () => {
    test('returns false when fields are the same', () => {
      const field1: ModelField = {
        type: 'number',
        slug: 'id',
        unique: true,
      };
      const field2: ModelField = {
        type: 'number',
        slug: 'id',
        unique: true,
      };
      const diff = CompareModels.fieldsAreDifferent(field1, field2);
      expect(diff).toBe(false);
    });

    test('returns true when fields have different properties', () => {
      const field1: ModelField = {
        type: 'number',
        slug: 'id',
      };
      const field2: ModelField = {
        type: 'number',
        slug: 'id',
        unique: false,
        required: true,
        defaultValue: 'test',
      };
      const diff = CompareModels.fieldsAreDifferent(field1, field2);
      expect(diff).toBe(true);
    });

    test('returns true when fields have ronin_undefined', () => {
      const field1: ModelField = {
        type: 'number',
        slug: 'id',
      };
      const field2: ModelField = {
        type: 'number',
        slug: 'id',
        defaultValue: 'RONIN_undefined',
      };
      const diff = CompareModels.fieldsAreDifferent(field1, field2);
      expect(diff).toBe(true);
    });

    test('returns true when fields have different slug', () => {
      const field1: ModelField = {
        type: 'number',
        slug: 'id',
      };
      const field2: ModelField = {
        type: 'number',
        slug: 'profile',
      };
      const diff = CompareModels.fieldsAreDifferent(field1, field2);
      expect(diff).toBe(true);
    });

    test('returns true when fields have different type', () => {
      const field1: ModelField = {
        type: 'number',
        slug: 'id',
      };
      const field2: ModelField = {
        type: 'string',
        slug: 'id',
      };
      const diff = CompareModels.fieldsAreDifferent(field1, field2);
      expect(diff).toBe(true);
    });

    test('returns true when fields have different name', () => {
      const field1: ModelField = {
        type: 'number',
        slug: 'id',
        name: 'ID',
      };
      const field2: ModelField = {
        type: 'number',
        slug: 'id',
        name: 'Identifier',
      };
      const diff = CompareModels.fieldsAreDifferent(field1, field2);
      expect(diff).toBe(true);
    });

    test('returns true when fields have different autoincrement', () => {
      const field1: ModelField = {
        type: 'number',
        slug: 'id',
        increment: true,
      };
      const field2: ModelField = {
        type: 'number',
        slug: 'id',
        increment: false,
      };
      const diff = CompareModels.fieldsAreDifferent(field1, field2);
      expect(diff).toBe(true);
    });
  });

  describe('diff fields', () => {
    test('creates new field', async () => {
      const localFields: Array<ModelField> = [
        {
          type: 'number',
          slug: 'id',
        },
        {
          type: 'string',
          slug: 'name',
        },
      ];
      const remoteFields: Array<ModelField> = [
        {
          type: 'number',
          slug: 'id',
        },
      ];

      const localModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: localFields,
      };
      const remoteModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: remoteFields,
      };
      const diff = await new CompareModels(localModel, remoteModel, {
        rename: true,
      }).diff();
      expect(diff).toHaveLength(1);
      expect(diff).toStrictEqual([
        'alter.model(\'account\').create.field({"type":"string","slug":"name"})',
      ]);
    });

    test('drops field', async () => {
      const localFields: Array<ModelField> = [
        {
          type: 'number',
          slug: 'id',
        },
      ];
      const remoteFields: Array<ModelField> = [
        {
          type: 'number',
          slug: 'id',
        },
        {
          type: 'string',
          slug: 'name',
        },
      ];

      const localModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: localFields,
      };
      const remoteModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: remoteFields,
      };
      const diff = await new CompareModels(localModel, remoteModel, {
        rename: true,
      }).diff();
      expect(diff).toHaveLength(1);
      expect(diff).toStrictEqual(['alter.model("account").drop.field("name")']);
    });

    test('handles field adjustments', async () => {
      const localFields: Array<ModelField> = [
        {
          type: 'number',
          slug: 'id',
          unique: true,
        },
      ];
      const remoteFields: Array<ModelField> = [
        {
          type: 'number',
          slug: 'id',
          unique: false,
        },
      ];
      const localModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: localFields,
      };
      const remoteModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: remoteFields,
      };
      const diff = await new CompareModels(localModel, remoteModel, {
        rename: true,
        name: 'Account',
        pluralName: 'Accounts',
        pluralSlug: 'accounts',
      }).diff();

      expect(diff).toHaveLength(4);
      expect(diff).toStrictEqual([
        'create.model({"slug":"RONIN_TEMP_account","fields":{"id":{"type":"number","unique":true}},"idPrefix":"acc"})',
        'add.RONIN_TEMP_accounts.with(() => get.accounts())',
        'drop.model("account")',
        'alter.model("RONIN_TEMP_account").to({slug: "account", name: "Account", pluralName: "Accounts"})',
      ]);
    });

    test('handles link field renames', async () => {
      const localFields: Array<ModelField> = [
        {
          type: 'link',
          slug: 'newProfile',
          target: 'profile',
        },
      ];
      const remoteFields: Array<ModelField> = [
        {
          type: 'link',
          slug: 'profile',
          target: 'profile',
        },
      ];
      const localModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: localFields,
      };
      const remoteModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: remoteFields,
      };
      const diff = await new CompareModels(localModel, remoteModel, {
        rename: true,
        name: 'Account',
        pluralName: 'Accounts',
        pluralSlug: 'accounts',
      }).diff();

      expect(diff).toHaveLength(5);
      expect(diff).toStrictEqual([
        'create.model({"slug":"RONIN_TEMP_account","fields":{"profile":{"type":"link","target":"profile"}},"idPrefix":"acc"})',
        'add.RONIN_TEMP_accounts.with(() => get.accounts())',
        'alter.model("RONIN_TEMP_account").alter.field("profile").to({slug: "newProfile"})',
        'drop.model("account")',
        'alter.model("RONIN_TEMP_account").to({slug: "account", name: "Account", pluralName: "Accounts"})',
      ]);
    });

    test('handles string field renames', async () => {
      const localFields: Array<ModelField> = [
        {
          type: 'string',
          slug: 'newProfile',
        },
      ];
      const remoteFields: Array<ModelField> = [
        {
          type: 'string',
          slug: 'profile',
        },
      ];
      const localModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: localFields,
      };
      const remoteModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: remoteFields,
      };
      const diff = await new CompareModels(localModel, remoteModel, {
        rename: true,
      }).diff();
      expect(diff).toHaveLength(1);
      expect(diff).toStrictEqual([
        'alter.model("account").alter.field("profile").to({slug: "newProfile"})',
      ]);
    });
  });

  describe('fields to rename', () => {
    test('identifies fields to rename based on matching properties', () => {
      const localFields: Array<ModelField> = [
        {
          type: 'string',
          slug: 'newName',
          unique: true,
          required: true,
        },
      ];
      const remoteFields: Array<ModelField> = [
        {
          type: 'string',
          slug: 'name',
          unique: true,
          required: true,
        },
      ];

      const localModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: localFields,
      };
      const remoteModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: remoteFields,
      };
      const result = new CompareModels(localModel, remoteModel, {
        rename: true,
      }).fieldsToRename();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: remoteFields[0],
        to: localFields[0],
      });
    });

    test('does not identify fields to rename when properties differ', () => {
      const localFields: Array<ModelField> = [
        {
          type: 'string',
          slug: 'newName',
          unique: true,
        },
      ];
      const remoteFields: Array<ModelField> = [
        {
          type: 'number',
          slug: 'name',
          unique: true,
        },
      ];

      const localModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: localFields,
      };
      const remoteModel: ModelWithFieldsArray = {
        slug: 'account',
        fields: remoteFields,
      };
      const result = new CompareModels(localModel, remoteModel, {
        rename: true,
      }).fieldsToRename();
      expect(result).toHaveLength(0);
    });
  });
});
