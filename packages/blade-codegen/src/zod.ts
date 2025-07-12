import { convertToPascalCase } from '@/src/utils/slug';

import type { ModelField } from '@ronin/compiler';

import type { Model } from '@/src/types/model';

type ModelFieldType = Required<ModelField>['type'];

const ZOD_FIELD_TYPES = {
  blob: 'unknown',
  boolean: 'boolean',
  date: 'date', // TODO(@nurodev): Should this be `z.date()` or `z.string().datetime()`?
  json: 'JsonSchema',
  link: 'unknown',
  number: 'number',
  string: 'string',
} satisfies Record<ModelFieldType, string>;

const JSON_SCHEMA = `const JsonLiteralSchema = z.union([
  z.boolean(),
  z.null(),
  z.number(),
  z.string(),
]);

type Json = z.infer<typeof JsonLiteralSchema> | { [key: string]: Json } | Array<Json>;

const ${ZOD_FIELD_TYPES.json}: z.ZodType<Json> = z.lazy(() =>
  z.union([
    JsonLiteralSchema,
    z.array(${ZOD_FIELD_TYPES.json}),
    z.record(${ZOD_FIELD_TYPES.json})
  ])
);
`;

/**
 * Generates the complete `index.ts` Zod schema file for a list of RONIN models.
 *
 * @param models - A list of models to generate the the types for.
 *
 * @returns A string of the complete `index.ts` file.
 */
export const generateZodSchema = (models: Array<Model>): string => {
  const lines = new Array<string | null>('import { z } from "zod";\n');

  // If no models are provided, an empty export is needed to avoid errors.
  if (models.length <= 0) lines.push('export {};');

  // Only add the `JsonSchema` schema if at least one model has a `json` field.
  const hasJsonField = models.some((model) =>
    Object.values(model.fields).some((field) => field.type === 'json'),
  );
  if (hasJsonField) {
    lines.push(JSON_SCHEMA);
  }

  for (const model of models) {
    const modelName = convertToPascalCase(model.slug);

    const entries = new Map<string, string | Map<string, string>>();
    for (const [fieldSlug, field] of Object.entries(model.fields)) {
      const chainedSchemaMethods = new Array<string>();
      switch (field.type) {
        case 'json': {
          chainedSchemaMethods.push(ZOD_FIELD_TYPES.json);
          break;
        }
        default: {
          const fieldType = field.type as ModelFieldType;
          const zodType = ZOD_FIELD_TYPES[fieldType];
          if (!zodType) continue;
          chainedSchemaMethods.push(`z.${zodType}()`);
          break;
        }
      }

      if (fieldSlug === 'email' && field.type === 'string')
        chainedSchemaMethods.push('email()');

      if (field.required !== true && !('defaultValue' in field))
        chainedSchemaMethods.push('optional()');

      if (fieldSlug === 'id' && field.type === 'string')
        chainedSchemaMethods.push('readonly()');

      if (!fieldSlug.includes('.')) {
        entries.set(fieldSlug, chainedSchemaMethods.join('.'));
        continue;
      }

      const [nestedFieldKey, nestedFieldSubKey] = fieldSlug.split('.');
      const nestedFieldMap = entries.get(nestedFieldKey) ?? new Map<string, string>();
      if (typeof nestedFieldMap !== 'string') {
        nestedFieldMap.set(nestedFieldSubKey, chainedSchemaMethods.join('.'));
      }

      entries.set(nestedFieldKey, nestedFieldMap);
    }

    lines.push(
      `export const ${modelName}Schema = z.object({\n${Array.from(entries)
        .map(([key, value]) => {
          if (typeof value === 'string') return `\t${key}: ${value},`;

          const zodObjectBody = Array.from(value.entries())
            .map(([nestedKey, nestedValue]) => `\t\t${nestedKey}: ${nestedValue},`)
            .join('\n');
          return `\t${key}: z.object({\n${zodObjectBody}\n\t}),`;
        })
        .join('\n')}\n});`,
    );
  }

  return `${lines.join('\n')}\n`;
};
