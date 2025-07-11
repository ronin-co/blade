import type { Model, ModelField, ModelPreset } from '@/src/types/model';
import type { Instructions, SetInstructions } from '@/src/types/query';
import { QUERY_SYMBOLS } from '@/src/utils/constants';
import { CompilerError, findInObject, isObject } from '@/src/utils/helpers';

/**
 * Generates the SQL syntax for the `using` query instruction, which allows for quickly
 * adding a list of pre-defined instructions to a query.
 *
 * @param model - The model associated with the current query.
 * @param instructions - The instructions of the current query.
 *
 * @returns The SQL syntax for the provided `using` instruction.
 */
export const handleUsing = (
  model: Model,
  instructions: Instructions & SetInstructions,
): Instructions & SetInstructions => {
  // The `using` instruction might either contain an array of preset slugs, or an object
  // in which the keys are preset slugs and the values are arguments that should be
  // passed to the respective presets.
  const normalizedUsing = Array.isArray(instructions.using)
    ? Object.fromEntries(instructions.using.map((presetSlug) => [presetSlug, null]))
    : (instructions.using as Record<string, string>);

  // If a preset with the slug `links` is being requested, add the presets of all link
  // fields separately.
  if ('links' in normalizedUsing) {
    for (const [fieldSlug, rest] of Object.entries(model.fields)) {
      const field = { slug: fieldSlug, ...rest } as ModelField;
      if (field.type !== 'link' || field.kind === 'many') continue;
      normalizedUsing[fieldSlug] = null;
    }
  }

  for (const presetSlug in normalizedUsing) {
    // Ignore the `links` slug, because it is a special alias that is resolved above.
    if (!Object.hasOwn(normalizedUsing, presetSlug) || presetSlug === 'links') continue;

    const arg = normalizedUsing[presetSlug];
    const preset = model.presets?.[presetSlug];

    if (!preset) {
      throw new CompilerError({
        message: `Preset "${presetSlug}" does not exist in model "${model.name}".`,
        code: 'PRESET_NOT_FOUND',
      });
    }

    const replacedUsingFilter = structuredClone(
      preset.instructions,
    ) as ModelPreset['instructions'];

    // If an argument was provided for the preset, find the respective placeholders
    // inside the preset and replace them with the value of the actual argument.
    if (arg !== null) {
      findInObject(replacedUsingFilter, QUERY_SYMBOLS.VALUE, (match: string) =>
        match.replace(QUERY_SYMBOLS.VALUE, arg),
      );
    }

    for (const subInstruction in replacedUsingFilter) {
      if (!Object.hasOwn(replacedUsingFilter, subInstruction)) continue;

      const instructionName = subInstruction as keyof Instructions;
      const currentValue = instructions[instructionName];

      // If the instruction is already present in the query, merge its existing value with
      // the value of the instruction that is being added.
      if (currentValue) {
        let newValue: unknown;

        if (Array.isArray(currentValue)) {
          newValue = Array.from(
            new Set([
              ...(replacedUsingFilter[instructionName] as Array<unknown>),
              ...(currentValue as Array<unknown>),
            ]),
          );
        } else if (isObject(currentValue)) {
          newValue = {
            ...(replacedUsingFilter[instructionName] as object),
            ...(currentValue as object),
          };
        }

        Object.assign(instructions, { [instructionName]: newValue });
        continue;
      }

      // If the instruction isn't already present in the query, add it.
      Object.assign(instructions, {
        [instructionName]: replacedUsingFilter[instructionName],
      });
    }
  }

  return instructions;
};
