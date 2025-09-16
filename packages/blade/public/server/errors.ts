type ErrorDetails = {
  message?: string;
  code?: string;
  fields?: string[];
  instructions?: string[];
};

/**
 * Utility function for combining field slugs into a human-readable string.
 *
 * @param fields - Array of field slugs to combine.
 *
 * @returns Human-readable representation of the provided field slugs.
 */
const joinFields = (fields: string[]): string =>
  !fields || fields.length === 0
    ? '[]'
    : fields.map((field) => `\`${field}\``).join(', ');

class TriggerError extends Error {
  code?: ErrorDetails['code'];
  fields?: ErrorDetails['fields'];
  instructions?: ErrorDetails['instructions'];

  constructor(details?: ErrorDetails) {
    super(details?.message);

    this.name = 'TriggerError';
    this.code = details?.code;
    this.fields = details?.fields || [];
    this.instructions = details?.instructions || [];
  }
}

class InvalidFieldsError extends TriggerError {
  constructor(details: ErrorDetails & { fields: string[]; reasons?: string[] }) {
    const { fields, reasons } = details;
    const joined = joinFields(fields);

    super({
      message:
        details?.message ||
        reasons?.join(' | ') ||
        `Invalid fields provided${fields?.length > 0 ? `: ${joined}` : ''}.`,
      code: details?.code || 'INVALID_FIELDS',
      fields: details.fields,
    });
  }
}

class EmptyFieldsError extends TriggerError {
  constructor(details: ErrorDetails & { fields: string[] }) {
    const { fields } = details;
    const joined = joinFields(fields);

    super({
      message:
        details?.message ||
        `Empty fields provided${fields?.length > 0 ? `: ${joined}` : ''}.`,
      code: details?.code || 'EMPTY_FIELDS',
      fields: details.fields,
    });
  }
}

class ExtraneousFieldsError extends TriggerError {
  constructor(details: ErrorDetails & { fields: string[] }) {
    const { fields } = details;
    const joined = joinFields(fields);

    super({
      message:
        details?.message ||
        `Extraneous fields provided${fields?.length > 0 ? `: ${joined}` : ''}.`,
      code: details?.code || 'EXTRANEOUS_FIELDS',
      fields: details.fields,
    });
  }
}

class RecordExistsError extends TriggerError {
  constructor(details?: ErrorDetails) {
    super({
      message: details?.message || 'The provided record already exists.',
      code: details?.code || 'RECORD_EXISTS',
      fields: details?.fields,
    });
  }
}

class RecordNotFoundError extends TriggerError {
  constructor(details?: ErrorDetails) {
    super({
      message: details?.message || 'No record could be found for the provided query.',
      code: details?.code || 'RECORD_NOT_FOUND',
      fields: details?.fields,
    });
  }
}

class TooManyRequestsError extends TriggerError {
  constructor(details?: ErrorDetails) {
    super({
      message:
        details?.message ||
        'The specified schema is being queried too quickly. Please try again later.',
      code: details?.code || 'TOO_MANY_REQUESTS',
      fields: details?.fields,
    });
  }
}

class InvalidPermissionsError extends TriggerError {
  constructor(details?: ErrorDetails) {
    super({
      message: details?.message || 'You do not have permission to perform this action.',
      code: details?.code || 'INVALID_PERMISSIONS',
    });
  }
}

class MultipleWithInstructionsError extends TriggerError {
  constructor() {
    super({
      message: 'The given `with` instruction must not be an array.',
      code: 'INVALID_QUERY_INSTRUCTIONS',
      instructions: ['with'],
    });
  }
}

export {
  TriggerError,
  InvalidFieldsError,
  EmptyFieldsError,
  ExtraneousFieldsError,
  RecordExistsError,
  RecordNotFoundError,
  TooManyRequestsError,
  InvalidPermissionsError,
  MultipleWithInstructionsError,
};
