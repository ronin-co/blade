import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  spyOn,
  test,
} from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import pull, { getModelDefinitionsFileContent } from '@/src/commands/pull';
import { formatCode } from '@/src/utils/format';
import { MODEL_IN_CODE_PATH } from '@/src/utils/misc';
import * as modelModule from '@/src/utils/model';
import * as confirmModule from '@inquirer/prompts';
import { $ } from 'bun';

afterAll(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('helper', () => {
  test('no models', async () => {
    spyOn(modelModule, 'getModels').mockResolvedValue([]);

    const models = await getModelDefinitionsFileContent();
    expect(models).toBeNull();
  });

  test('one simple model', async () => {
    spyOn(modelModule, 'getModels').mockResolvedValue([
      {
        slug: 'user',
        name: 'CustomName',
        fields: [
          {
            slug: 'name',
            type: 'string',
            required: true,
          },
          {
            slug: 'age',
            type: 'number',
          },
          {
            slug: 'isActive',
            type: 'boolean',
          },
        ],
      },
    ]);

    const models = await getModelDefinitionsFileContent();
    expect(models).toBeDefined();
    expect(models).toBe(
      formatCode(`import { boolean, model, number, string } from "blade/schema";

                export const User = model({
                slug: "user",
                name: "CustomName",
                fields: {
                    name: string({ required: true }),
                    age: number(),
                    isActive: boolean(),
                },
            });`),
    );
  });

  test('two models', async () => {
    spyOn(modelModule, 'getModels').mockResolvedValue([
      {
        slug: 'user',
        fields: [
          {
            slug: 'name',
            type: 'string',
            required: true,
          },
        ],
      },
      {
        slug: 'post',
        fields: [{ slug: 'title', type: 'string' }],
      },
    ]);

    const models = await getModelDefinitionsFileContent();
    expect(models).toBeDefined();
    expect(models).toBe(
      formatCode(`import { model, string } from "blade/schema";

export const User = model({
  slug: "user",
  fields: {
    name: string({ required: true }),
  },            
});

export const Post = model({
  slug: "post",
  fields: {
    title: string(),
  },
});`),
    );
  });

  test('model with index', async () => {
    spyOn(modelModule, 'getModels').mockResolvedValue([
      {
        slug: 'user',
        fields: [{ slug: 'name', type: 'string', required: true }],
        indexes: {
          indexSlug: {
            fields: [{ slug: 'name' }],
            unique: true,
          },
        },
      },
    ]);

    const models = await getModelDefinitionsFileContent();
    expect(models).toBeDefined();
    expect(models).toBe(
      formatCode(`import { model, string } from "blade/schema";

export const User = model({
  slug: "user",
  fields: {
    name: string({ required: true }),
  },
  indexes: { indexSlug: { fields: [{ slug: 'name' }], unique: true } },
});`),
    );
  });
});

describe('command', () => {
  const tempDir = path.join(tmpdir(), `ronin-test-${Date.now()}`);
  const originalCwd = process.cwd();

  spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('Process exit');
  });

  beforeAll(async () => {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    // Create temp directory.
    await fs.mkdir(tempDir, { recursive: true });
    // Change to temp directory.
    process.chdir(tempDir);
    // Initialize project.
    await $`bun init -y`;
    // Install RONIN packages.
    await $`bun add ronin@${packageJson.devDependencies.ronin || 'latest'}`;
    // Create schema directory.
    await fs.mkdir(path.join(tempDir, 'schema'));
  });

  afterAll(async () => {
    // Change back to original directory.
    process.chdir(originalCwd);
    // Clean up temp directory.
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up the schema directory.
    await fs.rm(MODEL_IN_CODE_PATH, { force: true });
  });

  test('no models', async () => {
    spyOn(modelModule, 'getModels').mockResolvedValue([]);

    try {
      await pull(undefined, undefined);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      // @ts-expect-error This is a mock.
      expect(error.message).toBe('Process exit');
    }
  });

  test('creates model file', async () => {
    // Mock a valid model response.
    spyOn(modelModule, 'getModels').mockResolvedValue([
      {
        slug: 'user',
        fields: [
          {
            slug: 'name',
            type: 'string',
            required: true,
          },
        ],
      },
    ]);

    await pull(undefined, undefined);

    // Verify file was created in temp directory.
    const fileExists = await fs.exists(MODEL_IN_CODE_PATH);

    expect(fileExists).toBe(true);

    // Verify file content.
    const content = await fs.readFile(MODEL_IN_CODE_PATH, 'utf-8');
    expect(content).toContain('export const User = model({');
    expect(content).toContain('name: string({ required: true })');
  });

  test('overwrites model file', async () => {
    // Create a model file.
    await fs.writeFile(MODEL_IN_CODE_PATH, '// This is a test.');

    // Mock confirm to return true.
    spyOn(confirmModule, 'confirm').mockResolvedValue(true);

    // Mock a valid model response.
    spyOn(modelModule, 'getModels').mockResolvedValue([
      {
        slug: 'user',
        fields: [
          {
            slug: 'name',
            type: 'string',
            required: true,
          },
        ],
      },
    ]);

    await pull(undefined, undefined);

    const fileExists = await fs.exists(MODEL_IN_CODE_PATH);

    expect(fileExists).toBe(true);

    // Verify file content
    const content = await fs.readFile(MODEL_IN_CODE_PATH, 'utf-8');
    expect(content).toContain('export const User = model({');
    expect(content).toContain('name: string({ required: true })');
  });

  test('dont overwrite model file', async () => {
    // Create a model file.
    await fs.writeFile(MODEL_IN_CODE_PATH, '// This is a test.');

    // Mock confirm to return true.
    spyOn(confirmModule, 'confirm').mockResolvedValue(false);

    // Mock a valid model response.
    spyOn(modelModule, 'getModels').mockResolvedValue([
      {
        slug: 'user',
        fields: [
          {
            slug: 'name',
            type: 'string',
            required: true,
          },
        ],
      },
    ]);

    await pull(undefined, undefined);

    const fileExists = await fs.exists(MODEL_IN_CODE_PATH);

    expect(fileExists).toBe(true);

    // Verify file content.
    const content = await fs.readFile(MODEL_IN_CODE_PATH, 'utf-8');
    expect(content).toBe('// This is a test.');
  });

  test('pulled model are up to date', async () => {
    // Create a model file.
    await fs.writeFile(
      MODEL_IN_CODE_PATH,
      `import { model } from "blade/schema";

export const User = model({
  slug: "user",
});
`,
    );

    // Mock confirm to return true.
    spyOn(confirmModule, 'confirm').mockResolvedValue(false);

    // Mock a valid model response.
    spyOn(modelModule, 'getModels').mockResolvedValue([
      {
        slug: 'user',
        fields: [],
      },
    ]);

    await pull(undefined, undefined);

    const fileExists = await fs.exists(MODEL_IN_CODE_PATH);

    expect(fileExists).toBe(true);

    // Verify file content.
    const content = await fs.readFile(MODEL_IN_CODE_PATH, 'utf-8');
    expect(content).toBe(
      'import { model } from "blade/schema";\n\nexport const User = model({\n  slug: "user",\n});\n',
    );
  });
});
