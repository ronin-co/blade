import fs from 'node:fs/promises';
import path from 'node:path';
import type { parseArgs } from 'node:util';
import { generate } from '@ronin/codegen';
import { generateZodSchema } from '@ronin/codegen/zod';

import { CompilerError } from 'blade-compiler';

import type { BaseFlags } from '@/src/utils/misc';
import { getModels } from '@/src/utils/model';
import { getOrSelectSpaceId } from '@/src/utils/space';
import { spinner as ora } from '@/src/utils/spinner';
import {
  TYPES_DTS_FILE_NAME,
  ZOD_SCHEMA_FILE_NAME,
  injectTSConfigInclude,
} from '@/src/utils/types';

/**
 * Command line flags for types operations.
 */
export const TYPES_FLAGS = {
  zod: { type: 'boolean', short: 'z', default: false },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

export type TypesFlags = BaseFlags & Partial<Record<keyof typeof TYPES_FLAGS, boolean>>;

export default async (
  appToken: string | undefined,
  sessionToken: string | undefined,
  flags?: TypesFlags,
): Promise<void> => {
  const spinner = ora.info(flags?.zod ? 'Generating Zod schemas' : 'Generating types');

  try {
    const space = await getOrSelectSpaceId(sessionToken, spinner);

    const configDir = path.join(process.cwd(), '.ronin');
    const configDirExists = await fs.exists(configDir);
    if (!configDirExists) await fs.mkdir(configDir);

    const models = (await getModels({
      token: appToken ?? sessionToken,
      space: space,
      fieldArray: false,
    })) as Parameters<typeof generateZodSchema>[0];

    if (flags?.zod) {
      const zodSchemas = generateZodSchema(models);
      await fs.writeFile(path.join(configDir, ZOD_SCHEMA_FILE_NAME), zodSchemas);
    } else {
      const code = generate(models);

      const typesFilePath = path.join(configDir, TYPES_DTS_FILE_NAME);
      await fs.writeFile(typesFilePath, code);

      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfigContents = await injectTSConfigInclude(tsconfigPath);
      await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigContents, null, 2));
    }

    spinner.succeed('Successfully generated types');
  } catch (err) {
    const message =
      err instanceof CompilerError ? err.message : 'Failed to generate types';

    spinner.fail(message);

    !(err instanceof CompilerError) && err instanceof Error && spinner.fail(err.message);

    process.exit(1);
  }
};
