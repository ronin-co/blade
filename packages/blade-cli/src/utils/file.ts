import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Checks if a file exists.
 *
 * @param file - The path of the file to check.
 *
 * @returns A promise that resolves to a boolean indicating whether the file exists.
 */
export const exists = async (file: string): Promise<boolean> => {
  try {
    await fs.access(path.join(process.cwd(), file));
  } catch (_err) {
    return false;
  }

  return true;
};
