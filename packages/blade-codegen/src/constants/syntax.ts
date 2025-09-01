/**
 * A list of all inferred combined instruction properties for RONIN models.
 */
export const INFERRED_COMBINED_INSTRUCTION_PROPERTIES = [
  'after',
  'before',
  'including',
  'limitedTo',
  'orderedBy',
  'selecting',

  // TODO(@nurodev): Move out & only include `using` if the model includes any link fields.
  'using',
] satisfies Array<string>;
