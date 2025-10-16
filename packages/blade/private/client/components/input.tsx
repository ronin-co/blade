import type { FunctionComponent, InputHTMLAttributes } from 'react';

import type { FieldType } from '@/private/client/components/form';

type InputValue = string | number | boolean | object | null;

const stringifyFormValue = (value: InputValue): string | number => {
  let newValue: string | number;

  // Serialize boolean values.
  if (typeof value === 'boolean') {
    newValue = value.toString();
  }

  // Serialize `null` values.
  else if (value === null) {
    newValue = 'null';
  } else if (typeof value === 'object') {
    newValue = JSON.stringify(value);
  } else {
    newValue = value || '';
  }

  return newValue;
};

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  /** The value to be stored for the field in the Blade model. */
  value?: InputValue;
  /** The type of the field in the Blade model. */
  fieldType?: FieldType;
}

const Input: FunctionComponent<InputProps> = ({ value, fieldType, ...rest }) => {
  const initialValue = typeof value === 'undefined' ? value : stringifyFormValue(value);

  if (!fieldType) {
    switch (rest.type) {
      case 'number':
        fieldType = 'INT64';
        break;

      case 'checkbox':
        fieldType = 'BOOL';
        break;

      default:
        fieldType = 'STRING';
    }
  }

  return (
    <input
      // The type used when storing the value in the database.
      data-type={fieldType}
      value={initialValue}
      {...rest}
    />
  );
};

export { Input };
