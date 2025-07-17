import { afterAll, afterEach, describe, expect, jest, spyOn, test } from 'bun:test';
import * as logInModule from '@/src/commands/login';
import { initializeDatabase } from '@/src/utils/database';
import * as getModelsModule from '@/src/utils/model';
import { clearMocks, mock } from 'bun-bagel';
describe('models', async () => {
  afterAll(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const db = await initializeDatabase('./tests/fixtures/minimal.db');

  describe('local', () => {
    test('get models from local but there are no models', async () => {
      const models = await getModelsModule.getModels({ db });

      expect(models).toHaveLength(0);
      expect(models).toStrictEqual([]);
    });

    test('get models from local with model', async () => {
      await db.query([
        `
      INSERT INTO "ronin_schema" ("slug", "fields", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug", "presets", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ('blog', '{"id":{"name":"ID","type":"string","displayAs":"single-line"},"ronin":{"name":"RONIN","type":"group"},"ronin.locked":{"name":"RONIN - Locked","type":"boolean"},"ronin.createdAt":{"name":"RONIN - Created At","type":"date"},"ronin.createdBy":{"name":"RONIN - Created By","type":"string"},"ronin.updatedAt":{"name":"RONIN - Updated At","type":"date"},"ronin.updatedBy":{"name":"RONIN - Updated By","type":"string"},"name":{"name":"Name","unique":false,"increment":false,"required":false,"type":"string"},"author":{"name":"Author","unique":false,"increment":false,"required":true,"type":"link","target":"profile"},"published":{"name":"Published","unique":false,"increment":false,"required":false,"defaultValue":false,"type":"boolean"},"hero":{"name":"Hero","unique":false,"increment":false,"required":false,"type":"blob"}}', 'blogs', 'Blog', 'Blogs', 'blo', 'blogs', 'id', 'id', '{"author":{"instructions":{"including":{"author":{"__RONIN_QUERY":{"get":{"profile":{"with":{"id":{"__RONIN_EXPRESSION":"__RONIN_FIELD_PARENT_author"}}}}}}}}}}', 'mod_hji0v5g6gy2hhvwj', '2024-12-05T14:16:26.802Z', '2024-12-05T14:16:26.802Z') RETURNING *
      `,
        `
      UPDATE "ronin_schema" SET "indexes" = json_insert("indexes", '$.indexSlug', '{"slug":"indexSlug","fields":[{"slug":"author"},{"slug":"name"}],"unique":true}'), "ronin.updatedAt" = '2024-12-05T14:16:26.805Z' WHERE ("slug" = 'blog') RETURNING *
      `,
      ]);

      const models = await getModelsModule.getModels({ db });

      expect(models).toHaveLength(1);

      // Clean up
      await db.query([`DELETE FROM "ronin_schema" WHERE "slug" = 'blog';`]);
    });

    test('get models with field object', async () => {
      await db.query([
        `
      INSERT INTO "ronin_schema" ("slug", "fields", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug", "presets", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ('blog', '{"id":{"name":"ID","type":"string","displayAs":"single-line"},"ronin":{"name":"RONIN","type":"group"},"ronin.locked":{"name":"RONIN - Locked","type":"boolean"},"ronin.createdAt":{"name":"RONIN - Created At","type":"date"},"ronin.createdBy":{"name":"RONIN - Created By","type":"string"},"ronin.updatedAt":{"name":"RONIN - Updated At","type":"date"},"ronin.updatedBy":{"name":"RONIN - Updated By","type":"string"},"name":{"name":"Name","unique":false,"increment":false,"required":false,"type":"string"},"author":{"name":"Author","unique":false,"increment":false,"required":true,"type":"link","target":"profile"},"published":{"name":"Published","unique":false,"increment":false,"required":false,"defaultValue":false,"type":"boolean"},"hero":{"name":"Hero","unique":false,"increment":false,"required":false,"type":"blob"}}', 'blogs', 'Blog', 'Blogs', 'blo', 'blogs', 'id', 'id', '{"author":{"instructions":{"including":{"author":{"__RONIN_QUERY":{"get":{"profile":{"with":{"id":{"__RONIN_EXPRESSION":"__RONIN_FIELD_PARENT_author"}}}}}}}}}}', 'mod_hji0v5g6gy2hhvwj', '2024-12-05T14:16:26.802Z', '2024-12-05T14:16:26.802Z') RETURNING *
      `,
        `
      UPDATE "ronin_schema" SET "indexes" = json_insert("indexes", '$.indexSlug', '{"slug":"indexSlug","fields":[{"slug":"author"},{"slug":"name"}],"unique":true}'), "ronin.updatedAt" = '2024-12-05T14:16:26.805Z' WHERE ("slug" = 'blog') RETURNING *
      `,
      ]);

      const models = await getModelsModule.getModels({ db, fieldArray: false });

      expect(models).toHaveLength(1);
      expect(models[0].fields).toBeTypeOf('object');

      // Clean up
      await db.query([`DELETE FROM "ronin_schema" WHERE "slug" = 'blog';`]);
    });
  });

  describe('production', async () => {
    afterEach(() => {
      clearMocks();
    });

    test('get models from production with models', async () => {
      mock('https://data.ronin.co/?data-selector=updated-bsql-ip', {
        response: {
          status: 200,
          data: {
            results: [
              {
                records: [],
              },
            ],
          },
        },
        method: 'POST',
      });

      const models = await getModelsModule.getModels({
        db,
        token: '',
        space: 'updated-bsql-ip',
        isLocal: false,
      });

      expect(models).toStrictEqual([]);
      expect(models).toHaveLength(0);
    });

    test('get models from production but there are no models', async () => {
      mock('https://data.ronin.co/?data-selector=updated-bsql-ip', {
        response: {
          status: 200,
          data: {
            results: [
              {
                records: [],
              },
            ],
          },
        },
        method: 'POST',
      });

      const models = await getModelsModule.getModels({
        db,
        token: '',
        space: 'updated-bsql-ip',
        isLocal: false,
      });

      expect(models).toStrictEqual([]);
      expect(models).toHaveLength(0);
    });

    test('get models fails with invalid session', async () => {
      mock('https://data.ronin.co/?data-selector=test', {
        response: {
          status: 400,
          data: JSON.stringify({
            error: {
              message: 'This session is no longer valid. Please sign in again.',
              code: 'AUTH_INVALID_SESSION',
            },
            data: null,
          }),
        },
        method: 'POST',
      });

      spyOn(logInModule, 'default').mockImplementation(() => {
        throw new Error(
          'Failed to fetch remote models: This session is no longer valid.',
        );
      });

      try {
        await getModelsModule.getModels({
          db,
          token: '',
          space: 'test',
          isLocal: false,
        });
      } catch (err) {
        const error = err as Error;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(
          'Failed to fetch remote models: This session is no longer valid.',
        );
      }
    });
  });
});
