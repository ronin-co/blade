import fs from 'node:fs/promises';

import json5 from 'json5';

/**
 * The name of the TypeScript declaration file stored inside the `.ronin` directory.
 */
export const TYPES_DTS_FILE_NAME = 'types.d.ts';

/**
 * The name of the Zod schemas file stored inside the `.ronin` directory.
 */
export const ZOD_SCHEMA_FILE_NAME = 'zod.ts';

/**
 * The name of the TypeScript declaration file stored inside the `.ronin` directory.
 */
const TYPES_INCLUDE_PATH = '.ronin/*.d.ts';

/**
 * Add the path to the generated TypeScript types to the `tsconfig.json` file.
 *
 * @param path - Path to the `tsconfig.json` file.
 *
 * @returns Promise resolving to void.
 */
export const injectTSConfigInclude = async (
  path: string,
): Promise<{
  compilerOptions: Record<string, unknown>;
  include: Array<string>;
}> => {
  // Set a base TypeScript config used for every project.
  const contents = {
    compilerOptions: {},
    include: new Array<string>(),
  };

  // Attempt to load the existing `tsconfig.json` file.
  const fileExists = await fs
    .stat(path)
    .then(() => true)
    .catch(() => false);
  if (fileExists) {
    const fileContents = await fs.readFile(path, 'utf-8');
    const json = json5.parse(fileContents);
    Object.assign(contents, json);
  }

  // If the user has not already provided any `include` files then
  // we need to add some defaults so their code base continues to act
  // like it does currently.
  if (contents.include.length <= 0) contents.include.push('**/*.ts', '**/*.tsx');

  // Add the path to the generated TypeScript types to the `tsconfig.json` file.
  if (!contents.include.includes(TYPES_INCLUDE_PATH))
    contents.include.push(TYPES_INCLUDE_PATH);

  return contents;
};
