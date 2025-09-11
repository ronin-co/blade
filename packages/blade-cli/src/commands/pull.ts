import * as fs from 'node:fs/promises';
import { confirm } from '@inquirer/prompts';

import { dirname } from 'node:path';
import { formatCode } from '@/src/utils/format';
import { MODEL_IN_CODE_PATH } from '@/src/utils/misc';
import { type ModelWithFieldsArray, getModels } from '@/src/utils/model';
import { spinner as ora } from '@/src/utils/spinner';

/**
 * Pulls models from RONIN schema into model definitions file.
 *
 * @param appToken - The app token to use.
 * @param sessionToken - The session token to use.
 */
export default async (appToken?: string, sessionToken?: string): Promise<void> => {
  const spinner = ora.start('Pulling models');

  try {
    // Get models from RONIN schema.
    const modelDefinitions = await getModelDefinitionsFileContent({
      appToken,
      sessionToken,
    });

    if (!modelDefinitions) {
      spinner.fail('No models found. Start defining models in your code.');
      process.exit(1);
    }

    if ((await fs.exists(MODEL_IN_CODE_PATH)) && modelDefinitions) {
      if (
        JSON.stringify(modelDefinitions) ===
        JSON.stringify(await fs.readFile(MODEL_IN_CODE_PATH, 'utf-8'))
      ) {
        spinner.succeed('Your model definitions are up to date.');
        return;
      }

      spinner.stop();
      const overwrite = await confirm({
        message: 'A model definition file already exists. Do you want to overwrite it?',
      });
      spinner.start();

      if (!overwrite) {
        return;
      }
    }

    if (!(await fs.exists(MODEL_IN_CODE_PATH))) {
      await fs.mkdir(dirname(MODEL_IN_CODE_PATH), { recursive: true });
    }

    await fs.writeFile(MODEL_IN_CODE_PATH, modelDefinitions);
    spinner.succeed('Models pulled');
  } catch {
    spinner.fail('Failed to pull models');
    process.exit(1);
  }
};

export const getModelDefinitionsFileContent = async (options?: {
  appToken?: string;
  sessionToken?: string;
}): Promise<string | null> => {
  const models = (await getModels({
    token: options?.appToken || options?.sessionToken,
  })) as Array<ModelWithFieldsArray>;

  if (models.length === 0) {
    return null;
  }

  const primitives = [
    ...new Set(models.flatMap((model) => model.fields.map((field) => field.type))),
  ];
  const importStatements = `import { model, ${primitives.join(',')} } from "blade/schema";`;

  const modelDefinitions = models.map((model) => {
    // We want to exclude the ronin property from the model.
    const { fields, indexes, ronin, ...rest } = model as ModelWithFieldsArray & {
      ronin: unknown;
    };

    const fieldsDefinition = fields
      .map((field) => {
        const { slug, type, ...rest } = field;

        return `${slug}: ${type}(${Object.keys(rest).length === 0 ? '' : JSON.stringify(rest)})`;
      })
      .join(',\n');

    return `export const ${capitalize(model.slug)} = model({
        ${JSON.stringify(rest).slice(1, -1)},
        ${
          fieldsDefinition
            ? `fields: {
            ${fieldsDefinition}
        },`
            : ''
        }
        ${indexes ? `indexes: ${JSON.stringify(indexes)}` : ''}
    });`;
  });

  return formatCode(`${importStatements}
    
    ${modelDefinitions.join('\n\n')}
  `);
};

const capitalize = (val: string): string => {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
};
