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

class DataHookError extends Error {
  code?: ErrorDetails['code'];
  fields?: ErrorDetails['fields'];
  instructions?: ErrorDetails['instructions'];

  constructor(details?: ErrorDetails) {
    super(details?.message);

    this.name = 'DataHookError';
    this.code = details?.code;
    this.fields = details?.fields || [];
    this.instructions = details?.instructions || [];
  }
}

class InvalidFieldsError extends DataHookError {
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

class EmptyFieldsError extends DataHookError {
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

class ExtraneousFieldsError extends DataHookError {
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

class RecordExistsError extends DataHookError {
  constructor(details?: ErrorDetails) {
    super({
      message: details?.message || 'The provided record already exists.',
      code: details?.code || 'RECORD_EXISTS',
      fields: details?.fields,
    });
  }
}

class RecordNotFoundError extends DataHookError {
  constructor(details?: ErrorDetails) {
    super({
      message: details?.message || 'No record could be found for the provided query.',
      code: details?.code || 'RECORD_NOT_FOUND',
      fields: details?.fields,
    });
  }
}

class TooManyRequestsError extends DataHookError {
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

class InvalidPermissionsError extends DataHookError {
  constructor(details?: ErrorDetails) {
    super({
      message: details?.message || 'You do not have permission to perform this action.',
      code: details?.code || 'INVALID_PERMISSIONS',
    });
  }
}

class AddNotAllowedError extends DataHookError {
  constructor(details?: ErrorDetails) {
    super({
      message:
        details?.message ||
        'Queries of type "add" are not supported for the provided schema.',
      code: 'INVALID_QUERY_TYPE',
    });
  }
}

class SetNotAllowedError extends DataHookError {
  constructor(details?: ErrorDetails) {
    super({
      message:
        details?.message ||
        'Queries of type "set" are not supported for the provided schema.',
      code: 'INVALID_QUERY_TYPE',
    });
  }
}

class RemoveNotAllowedError extends DataHookError {
  constructor(details?: ErrorDetails) {
    super({
      message:
        details?.message ||
        'Queries of type "remove" are not supported for the provided schema.',
      code: 'INVALID_QUERY_TYPE',
    });
  }
}

class MultipleWithInstructionsError extends DataHookError {
  constructor() {
    super({
      message: 'The given `with` instruction must not be an array.',
      code: 'INVALID_QUERY_INSTRUCTIONS',
      instructions: ['with'],
    });
  }
}

export {
  DataHookError,
  InvalidFieldsError,
  EmptyFieldsError,
  ExtraneousFieldsError,
  RecordExistsError,
  RecordNotFoundError,
  TooManyRequestsError,
  InvalidPermissionsError,
  AddNotAllowedError,
  SetNotAllowedError,
  RemoveNotAllowedError,
  MultipleWithInstructionsError,
};
