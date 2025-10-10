import type { ModelField, StoredObject } from 'blade-compiler';
import { assign, construct, dash } from 'radash';
import {
  type AnchorHTMLAttributes,
  type InputHTMLAttributes,
  type MutableRefObject,
  type PropsWithChildren,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import { useUniversalContext } from '@/private/universal/hooks';
import { useLinkEvents, useMutation } from '@/public/client/hooks';
import { TriggerError } from '@/public/server/errors';
import { useLocation, useParams, usePopulatePathname } from '@/public/universal/hooks';
import type { ResultRecord } from '@/public/universal/types';

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
  value: InputValue;
  /** The type of the field in the Blade model. */
  fieldType?: FieldType;
  /** Whether the field should be hidden. */
  hidden?: boolean;
}

const Input = ({ value, fieldType, hidden, ...rest }: InputProps) => {
  const stringValue = stringifyFormValue(value);

  if (!fieldType) {
    switch (rest.type) {
      case 'text':
        fieldType = 'STRING';
        break;

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
      value={stringValue}
      // If the input is marked as hidden, we neither want the input to be visible to the
      // eye, nor usable by accessibility tools.
      aria-hidden={hidden}
      readOnly={hidden}
      type={hidden ? 'hidden' : undefined}
      {...rest}
    />
  );
};

export { Input };
