import fs from 'node:fs';
import path from 'node:path';
import type { parseArgs } from 'node:util';
import { input } from '@inquirer/prompts';
import type { Model } from 'blade-compiler';

import { readConfig, saveConfig } from '@/src/utils/config';
import { CompareModels } from '@/src/utils/field';
import { convertModelToArrayFields } from '@/src/utils/model';
import { spinner } from '@/src/utils/spinner';

/** Represents a data item for logging */
interface DataItem {
  slug?: string;
  [key: string]: unknown;
}

/** Flags that are available for all sub commands. */
export const BASE_FLAGS = {
  help: {
    type: 'boolean',
    short: 'h',
    default: false,
  },
  version: {
    type: 'boolean',
    short: 'v',
    default: false,
  },
  debug: {
    type: 'boolean',
    short: 'd',
    default: false,
  },
} satisfies NonNullable<Parameters<typeof parseArgs>[0]>['options'];

/** Infers an object type from the list of base flags. */
export type BaseFlags = Record<keyof typeof BASE_FLAGS, boolean | undefined>;

/** Directory containing RONIN configuration files */
export const RONIN_CONFIG_DIR = '.ronin';

/** Directory containing RONIN model definitions */
export const MODELS_IN_CODE_DIR = 'schema';

/** Default relative path to the RONIN schema definitions file */
export const MODEL_IN_CODE_RELATIVE_PATH = path.join(MODELS_IN_CODE_DIR, 'index.ts');

/** Path to the RONIN schema definitions file */
export const MODEL_IN_CODE_PATH = path.resolve(
  process.cwd(),
  readConfig().modelsDir ?? MODEL_IN_CODE_RELATIVE_PATH,
);

/** Directory containing RONIN migrations */
export const MIGRATIONS_PATH = path.resolve(
  process.cwd(),
  RONIN_CONFIG_DIR,
  'migrations',
);

/** Suffix used for temporary RONIN schemas */
export const RONIN_SCHEMA_TEMP_SUFFIX = 'RONIN_TEMP_';

/**
 * Logs an array of data items in a tabular format for debugging purposes.
 *
 * @param data - Array of data items to be logged.
 * @param tableName - Name of the table for logging.
 */
export const logDataTable = (data: Array<DataItem>, tableName: string): void => {
  const allKeys = new Set<string>();

  // Collect all unique keys from the data items
  for (const item of data) {
    for (const key of Object.keys(item)) {
      allKeys.add(key);
    }
  }

  // Create column headers based on the slug or a default name
  const columnHeaders: Array<string> = [];
  for (let index = 0; index < data.length; index++) {
    const item = data[index];
    columnHeaders.push(item.slug || `Column${index}`);
  }

  const tableRows: Array<Record<string, unknown>> = [];

  // Build table rows by iterating over each key and data item
  for (const key of allKeys) {
    const row: Record<string, unknown> = { Property: key };
    for (let index = 0; index < data.length; index++) {
      const item = data[index];
      row[columnHeaders[index]] = item[key];
    }
    tableRows.push(row);
  }

  // Log the table
  console.log(`\nTable: ${tableName}`);
  console.table(tableRows);
  console.log('\n');
};

/**
/**
 * Logs the differences between two tables, highlighting added, modified and deleted fields.
 *
 * @param tableB - The new/modified table model.
 * @param tableA - The original table model.
 * @param tableName - Name of the table for logging.
 */
export const logTableDiff = (tableB: Model, tableA: Model, tableName: string): void => {
  const a = convertModelToArrayFields(tableA);
  const b = convertModelToArrayFields(tableB);
  // Get fields that were added and deleted between tables
  const fieldsToAdd = new CompareModels(b, a).fieldsToCreate(
    b.fields ?? [],
    a.fields ?? [],
  );
  const fieldsToDelete = new CompareModels(b, a).fieldsToDrop(
    b.fields ?? [],
    a.fields ?? [],
  );

  // Convert fields arrays to maps for easier lookup
  const fieldsA = Object.fromEntries(
    (a.fields ?? []).map((field) => [field.slug, field]),
  );

  // Get all unique property keys from both tables
  const allKeys = new Set<string>();
  for (const item of [...(b.fields ?? []), ...(a.fields ?? [])]) {
    for (const key of Object.keys(item)) {
      allKeys.add(key);
    }
  }

  // Create column headers with color formatting
  const columnHeaders = [
    // Headers for current fields (green for new fields)
    ...(b.fields ?? []).map((field) => {
      const isNew = fieldsToAdd.some((f) => f.slug === field.slug);
      return isNew ? `\x1b[32m${field.slug}\x1b[0m` : field.slug;
    }),
    // Headers for deleted fields (red + strikethrough)
    ...fieldsToDelete.map((field) => `\x1b[31m\x1b[9m${field.slug}\x1b[0m`),
  ];

  // Build table rows
  const tableRows = Array.from(allKeys)
    .map((key) => {
      const row: Record<string, unknown> = { Property: key };
      let hasValue = false;

      // Add values for current fields
      (b.fields ?? []).forEach((field, index) => {
        const oldValue = fieldsA[field.slug]?.[key as keyof typeof field];
        const newValue = field[key as keyof typeof field];

        if (newValue !== undefined) hasValue = true;

        // Format changed values with strikethrough old + green new
        row[columnHeaders[index]] =
          oldValue !== newValue && oldValue !== undefined
            ? `\x1b[31m\x1b[9m${oldValue}\x1b[0m → \x1b[32m${newValue}\x1b[0m`
            : `\x1b[0m${newValue}\x1b[0m`;
      });

      // Add values for deleted fields
      fieldsToDelete.forEach((field, i) => {
        const value = field[key as keyof typeof field];
        if (value !== undefined) hasValue = true;
        row[columnHeaders[b.fields?.length ?? 0 + i]] = `\x1b[31m\x1b[9m${value}\x1b[0m`;
      });

      return hasValue ? row : null;
    })
    .filter((row): row is Record<string, unknown> => row !== null);

  // Log the formatted table
  console.log(`\nTable: ${tableName}`);
  console.table(tableRows);
  console.log('\n');
};

/**
 * Retrieves model definitions from the code.
 *
 * @returns Promise resolving to an array of Model objects.
 *
 * @throws Will exit process if model definition file is not found.
 */
export const getModelDefinitions = async (customPath?: string): Promise<Array<Model>> => {
  let definedPath: string | undefined;
  if (!fs.existsSync(customPath ?? MODEL_IN_CODE_PATH)) {
    spinner.fail(`Could not find a model definition file ${MODEL_IN_CODE_RELATIVE_PATH}`);

    // If model definition file is not found at default path,
    // prompt user to specify custom path.
    definedPath =
      process.env.NODE_ENV !== 'test'
        ? await input({
            message: 'Enter the path to the model definition file',
          })
        : MODEL_IN_CODE_RELATIVE_PATH;

    if (!fs.existsSync(definedPath)) {
      spinner.fail('There is no migration file at the given path');
      process.exit(1);
    }
    saveConfig({ modelsDir: definedPath });
  }

  const sortedModels = sortModels(
    Object.values(await import(definedPath ?? customPath ?? MODEL_IN_CODE_PATH)).filter(
      (value): value is Model =>
        typeof value === 'object' && value !== null && 'slug' in value,
    ) as Array<Model>,
  );

  // Check for duplicate model slugs.
  const slugCounts = new Map<string, number>();
  for (const model of sortedModels) {
    const count = slugCounts.get(model.slug) ?? 0;
    slugCounts.set(model.slug, count + 1);
    if (count > 0) {
      spinner.fail(
        `Duplicate model slug found: "${model.slug}". You cannot have two models with the same slug.`,
      );
      process.exit(1);
    }
  }

  const notAllowedModel = sortedModels.find((model) => model.slug === '');

  if (notAllowedModel) {
    spinner.fail('The `slug` attribute of models must not be empty.');
    process.exit(1);
  }

  return sortedModels;
};

/**
 * Sorts models based on their dependencies to ensure models with dependencies are created
 * after their dependencies.
 *
 * @param models - Array of Model objects to sort.
 *
 * @returns Sorted array of Model objects with dependencies ordered correctly.
 *
 * @example
 * // If model B depends on model A, A will come before B in the sorted result
 * const models = [modelB, modelA];
 * const sorted = sortModels(models); // [modelA, modelB]
 */
export const sortModels = (models: Array<Model>): Array<Model> => {
  // Build a dependency map: slug -> set of slugs it depends on
  const dependencyMap = new Map<string, Set<string>>();

  // Initialize the map with empty sets
  for (const model of models) {
    dependencyMap.set(model.slug, new Set());
  }

  // Populate dependencies based on 'target' in fields,
  // but skip self-links
  for (const model of models) {
    for (const field of Object.values(model.fields ?? [])) {
      if (field.type === 'link' && field.target && field.target !== model.slug) {
        dependencyMap.get(model.slug)?.add(field.target);
      }
    }
  }

  // We'll use a Depth First Search (DFS) based topological sort with cycle detection
  const sortedSlugs: Array<string> = [];
  const visited = new Set<string>(); // Nodes that are fully processed
  const visiting = new Set<string>(); // Nodes in the current recursion stack

  function visit(slug: string): void {
    // Already fully sorted? Skip.
    if (visited.has(slug)) return;

    // If it's in the current stack, we've found a cycle
    if (visiting.has(slug)) {
      throw new Error(`Cycle detected in models. Slug causing cycle: "${slug}"`);
    }

    visiting.add(slug);

    // Recursively visit all dependencies
    for (const dep of dependencyMap.get(slug) ?? []) {
      visit(dep);
    }

    // Once we've processed all dependencies, remove from visiting
    visiting.delete(slug);
    visited.add(slug);

    // Place the slug into the final sorted order
    sortedSlugs.push(slug);
  }

  // Initiate a Depth First Search (DFS) from each model slug
  for (const model of models) {
    visit(model.slug);
  }

  // Convert slugs back to actual model objects
  return sortedSlugs.map((slug) => {
    const found = models.find((m) => m.slug === slug);
    if (!found) {
      throw new Error(`Model not found for slug: "${slug}"`);
    }
    return found;
  });
};

/**
 * Compares two arrays of objects and returns true if they are equal.
 *
 * @param arr1 - The first array of objects.
 * @param arr2 - The second array of objects.
 *
 * @returns True if the arrays are equal, false otherwise.
 */
export const areArraysEqual = (arr1: Array<string>, arr2: Array<string>): boolean => {
  if (arr1.length !== arr2.length) {
    return false;
  }

  return arr1.every((obj, index) => {
    return JSON.stringify(obj) === JSON.stringify(arr2[index]);
  });
};
