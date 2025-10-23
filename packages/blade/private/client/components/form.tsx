import type { ModelField } from 'blade-compiler';
import { assign, construct, dash } from 'radash';
import {
  type FunctionComponent,
  type PropsWithChildren,
  createContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { FormElement } from '@/private/client/components/form-element';
import { FORM_TARGET_PREFIX } from '@/private/client/utils/constants';
import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import { useMutation } from '@/public/client/hooks';
import { TriggerError } from '@/public/universal/errors';
import { useLocation, useParams, usePopulatePathname } from '@/public/universal/hooks';
import type { ResultRecord } from '@/public/universal/types';

export type FieldType =
  | 'BOOL'
  | 'STRING'
  | 'INT64'
  | 'FLOAT64'
  | 'DATE'
  | 'TIMESTAMP'
  | 'ARRAY'
  | 'JSON'
  | 'SUBQUERY'
  | 'READABLE';

const parseFormValue = (
  value: string | boolean | number | Date,
  type: FieldType,
): string | number | boolean | Date | unknown => {
  if (
    (typeof value === 'string' && value?.length === 0) ||
    value === null ||
    value === 'null'
  )
    return null;

  switch (type) {
    case 'BOOL':
      return typeof value === 'boolean' ? value : value === 'true';
    case 'STRING':
      return typeof value === 'string' ? value : String(value);
    case 'INT64':
    case 'FLOAT64':
      return typeof value === 'number' ? value : Number.parseFloat(value as string);
    case 'DATE':
    case 'TIMESTAMP':
      return value instanceof Date ? value : new Date(value as number);
    case 'ARRAY':
    case 'JSON':
      return typeof value === 'object' ? value : (JSON.parse(value as string) as unknown);
    case 'SUBQUERY':
    case 'READABLE':
      return value;
    default:
      throw new Error('Unsupported field type.');
  }
};

interface RegisterFormProps {
  current: HTMLFormElement;
}

type FormContextValue = {
  /**
   * A key that lets React clear the inputs when the props of `Form` change. This is
   * needed when rendering a `Form` on different pages that have the same layout, since
   * React re-uses the exact same DOM elements between different pages if their hierarchy
   * is the same (React doesn't even have a concept of pages, just DOM updates).
   */
  key: string;

  /** Method for submitting the form. */
  submit: () => Promise<void>;

  /** Whether the form is currently being submitted. */
  waiting: boolean;

  /** Whether the form should be cleared after its successful submission. */
  clearOnSuccess: boolean;

  /** Allows for registering a virtual field. */
  registerProperty: (
    name: string,
    type: RegisteredProperty['type'],
    getValue: RegisteredProperty['getValue'],
  ) => void;

  /** Allows for unregistering a virtual field. */
  unregisterProperty: (name: string) => void;

  /** Allows for setting the `redirect` prop via context. */
  registerRedirect: (destination: string) => void;

  /** Allows for unsetting the `redirect` prop via context. */
  unregisterRedirect: () => void;

  /** The resulting record of the form submission. */
  result: unknown | null;

  /** An error that occurred while submitting the form. */
  error: TriggerError | null;

  /**
   * The time when the form was last submitted. Allows for understanding whether the form
   * was even ever submitted, and if so, when.
   */
  updatedAt: Date | null;

  /** Allows for clearing all form fields. */
  reset: (clearFields?: true) => void;

  /** Allows for registering a new `form` element. */
  registerForm: ({ current }: RegisterFormProps) => string;

  /** Allows for unregistering a new `form` element. */
  unregisterForm: (id: string) => void;

  /** Whether the form should be interactive, or not. */
  disabled?: boolean;
};

type RegisteredProperty = {
  type: FieldType;
  getValue: () => void;
};

// Needed to match `@types/react` and thereby ensure green types when importing the
// context from an application.
type CtxArg = FormContextValue | null;
export const FormContext: React.Context<CtxArg> = createContext<CtxArg>(null);

type TargetRecord = Record<string, unknown> & Partial<ResultRecord>;

interface FormProps extends PropsWithChildren {
  /** The slug (singular) of the affected Blade model. */
  model: string;
  /** Called once the queries of the form have been executed successfully. */
  onSuccess?: (result: NonNullable<Result['value']>) => void;
  /** Called if one of the queries of the form fails to execute. */
  onError?: (error: Required<Result>['error']) => void;
  /**
   * Redirect to the given URL after the form was submitted successfully.
   *
   * Supports template syntax like "/{0.slug}" where {0} refers to the first object
   * in the array of returned results.
   *
   * @example ```
   * // Redirects to `/home` on success.
   * <FormControls model="team" redirect="/home" />
   * ```
   *
   * @example ```
   * // Redirects to `/teams/<slug>` on success.
   * <FormControls model="team" redirect="/teams/{0.slug}" />
   * ```
   *
   * Redirects can also be registered by invoking the `registerRedirect` method exposed
   * by the form context.
   */
  redirect?: string;
  /**
   * Whether the form should be interactive, or not.
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * Whether the form should be disabled while waiting for the submission
   * of the data it contains.
   */
  disabledWhileWaiting?: boolean;
  /**
   * If one of the fields submitted with the form is used in the URL, this prop
   * will ensure that the URL of the page automatically gets updated every time
   * the value of the field changes.
   */
  recordSlug?: {
    param: string;
    field: string;
    formatAs?: 'dash-case';
  };
  /**
   * Certain forms in the dashboard are designed for being submitted several
   * times in a row, with different values being present every time. For this
   * kind of form, we want to immediately clear all input fields within the
   * form after it is submitted, to make it easy for people to fill them again
   * right after that.
   */
  clearOnSuccess?: boolean;
  /**
   * Submits the query to a specific database. If this is not provided, the query will be
   * submitted to the default database.
   */
  database?: string;
  /**
   * Allows for resolving the values of the specified Record fields when
   * returning updated or created records. This is done by setting the
   * `including` instruction of the resulting query.
   */
  including?: Array<ModelField['slug']>;
  /**
   * If the fields associated with the provided field slugs are empty (`null`),
   * they will be excluded from the final query.
   *
   * This is useful in cases where certain fields should only be submitted if
   * they've received a value — such as when displaying the fields for changing
   * the password of an account.
   */
  excludeEmptyFields?: Array<string>;
  /**
   * The slug that the page for creating a new record has in the URL.
   *
   * @default "new"
   */
  newRecordSlug?: 'new';
  /** Disable the automatic creation of a `<form>` element. */
  noElement?: boolean;
  /**
   * Fields for matching a target record that should be modified. If not provided, a new
   * record will be created.
   */
  set?: TargetRecord | boolean;
  /**
   * Fields for matching a target record that should be removed. If not provided, a new
   * record will be created.
   */
  remove?: TargetRecord | boolean;
}

interface Result {
  value?: ResultRecord;
  error?: TriggerError;
  updatedAt: Date;
}

const Form: FunctionComponent<FormProps> = ({
  model,
  clearOnSuccess = false,
  children,
  onSuccess,
  onError,
  redirect,
  disabled: defaultDisabled,
  disabledWhileWaiting,
  recordSlug,
  database,
  including,
  excludeEmptyFields,
  newRecordSlug,
  noElement,
  set: shouldSet,
  remove: shouldRemove,
}) => {
  const forms = useRef<Record<string, HTMLFormElement>>({});
  const { set, add, remove } = useMutation();
  const { pathname } = useLocation();
  const params = useParams();
  const populatePathname = usePopulatePathname();

  const [waiting, setWaiting] = useState<boolean>(false);
  const [result, setResult] = useState<Result | null>(null);

  // We're using `useRef` here in order to allow for updating certain registered details
  // without causing a re-render.
  const registeredProperties = useRef<Record<string, RegisteredProperty>>({});
  const registeredRedirect = useRef<string | null>(redirect || null);

  const disabled = Boolean(defaultDisabled || (disabledWhileWaiting && waiting));

  const registerForm = ({ current }: RegisterFormProps) => {
    const id = crypto.randomUUID();
    forms.current[id] = current;

    return id;
  };

  const unregisterForm = (id: string) => {
    delete forms.current[id];
  };

  const submit = async () => {
    setWaiting(true);

    const values: Record<string, any> = {};
    const elements: Array<HTMLInputElement> = [];

    for (const form of Object.values(forms.current)) {
      const data = new FormData(form);

      data.forEach((value, key) => {
        const isArrayField = key.endsWith('[]');

        if (isArrayField) {
          // Strip the `[]` suffix from the key.
          const strippedKey = key.replace('[]', '');

          // Here, we are deliberately checking for the string `null` as the field value
          // has not been parsed yet.
          if (values[strippedKey] && value !== 'null') values[strippedKey].push(value);

          // When the first field of the array has its value set to `null`, we want to
          // initialize an empty array. This allows us to submit empty arrays through the
          // provided forms.
          if (!values[strippedKey]) values[strippedKey] = value === 'null' ? [] : [value];
        }
        // If an input is marked with this prefix, that means we have to use its value
        // to resolve the target record, instead of storing the value in the record.
        else if (key.startsWith(FORM_TARGET_PREFIX)) {
          const newKey = key.replace(FORM_TARGET_PREFIX, '');
          const expanded = construct({ [newKey]: value });

          // Deeply merge both objects.
          if (shouldRemove) {
            shouldRemove = assign(
              typeof shouldRemove === 'object' ? shouldRemove : {},
              expanded,
            ) as typeof shouldRemove;
          } else {
            shouldSet = assign(
              typeof shouldSet === 'object' ? shouldSet : {},
              expanded,
            ) as typeof shouldSet;
          }
        } else {
          values[key] = value;
        }
      });

      elements.push(...(Array.from(form.elements) as Array<HTMLInputElement>));
    }

    const currentTime = new Date();

    // In certain cases values have to be computed when the form is submitted, and not
    // before that. For example, this is necessary when computing the value involves
    // invoking a third-party service and that third-party service shouldn't be called on
    // every render, but instead only if a new value is submitted.
    //
    // A specific example for this would be that, whenever a new payment method is
    // provided on a web app, Stripe first has to consume the information of the
    // credit/debit card through a request to their API from our client-side, before we
    // can use the resulting information as part of a query. Because Stripe does not
    // let web apps access credit card information provided by users.
    for (const prop in registeredProperties.current) {
      try {
        values[prop] = await registeredProperties.current[prop]?.getValue();
      } catch (err: unknown) {
        const error = err as TriggerError;
        // If one of the registered properties fails to compute, we want to put the form
        // into a failed state and prevent any further code from being executed.
        setWaiting(false);
        setResult({ error, updatedAt: currentTime });

        if (onError) onError(error);

        return;
      }
    }

    let valuesNormalized: Record<
      string,
      string | number | boolean | null | ResultRecord['ronin']
    > = {};

    // In order to be able to correctly store the field values we've retrieved, we have
    // to know their type. Because Blade reads field values directly from HTML elements,
    // however, those types aren't persisted in memory, as HTML input elements convert
    // every value to a string, regardless of its original type. To be able to still
    // retrieve the original type of a value, we've added the type information as an
    // extra HTML property, and that's where we'll retrieve it from in the loop below.
    // Using the type, the values are then normalized back to their original type.
    for (const key in values) {
      let type: FieldType;

      // Fields provided by the system have their own special handling.
      switch (key) {
        case 'id':
          type = 'STRING';
          break;

        case 'ronin':
          type = 'JSON';
          break;

        default:
          type = (registeredProperties.current[key]?.type || undefined) as FieldType;
      }

      if (!type) {
        const element = elements.find(({ name }) => name === key || name === `${key}[]`);
        type = element?.getAttribute('data-type') as FieldType;
      }

      if (!type) {
        throw new Error(`No \`data-type\` provided for field "${key}".`);
      }

      const isChildOfJSON = key.includes('.');
      const isArray = Array.isArray(values[key]);
      const value = values[key];
      const normalizedValue = parseFormValue(value, type) as string | number | boolean;

      // If a field should be excluded from the final query if it's empty, we need to
      // prevent it from getting added to the final list of values.
      if (excludeEmptyFields?.includes(key) && normalizedValue === null) continue;

      if (isChildOfJSON) {
        // If the name of the field contains a dot, we know for a fact that it wants to
        // be nested into a JSON object.
        const expandable: Record<keyof typeof valuesNormalized, unknown> = {};
        expandable[key] = normalizedValue;

        // Deeply merge both objects.
        valuesNormalized = assign(
          valuesNormalized,
          construct(expandable),
        ) as typeof valuesNormalized;
      } else if (isArray) {
        valuesNormalized[key] = values[key].map(
          (value: string | number | boolean | Date) => parseFormValue(value, type),
        );
      } else {
        // If the name of the field does not contain a dot, however, we know for a fact
        // that it wants to be a top-level property.
        valuesNormalized[key] = normalizedValue;
      }
    }

    // If a `recordSlug` prop was provided to `Form` and the field within the record that
    // is used for the slug does not match the slug in the URL, this variable will
    // contain the new URL to which we want to redirect, so that the slug in the URL
    // matches the field that is used for the slug. For example, if the URL is
    // `/[team]/settings` and the field associated with `[team]` is called "handle", the
    // new URL will be `/{0.handle}/settings`, and Blade will replace `{0.handle}` with
    // the value of the "handle" field on the edge. We cannot construct this URL on the
    // client because certain fields (like "id") are generated on the edge.
    let slugRedirect: string | null = null;
    if (recordSlug) {
      // In the case of a catch-all page (like `[...record]`), the current param will
      // be an array.
      const currentParam = Array.isArray(params[recordSlug.param])
        ? params[recordSlug.param]?.[0]
        : params[recordSlug.param];

      const desiredParam =
        recordSlug.formatAs === 'dash-case'
          ? dash(valuesNormalized[recordSlug.field] as string)
          : (valuesNormalized[recordSlug.field] as string);

      if (currentParam !== desiredParam) {
        const newParam: string | null =
          // If the desired value of the selected param is available in the list of
          // fields, we can use the desired value.
          desiredParam ||
          // If the desired value of the selected param is not available in the list of
          // fields (because the page doesn't contain a field with that name), we want to
          // let Bkade infer it after the record is created. However, we only want to do
          // so if a record is being created.
          (currentParam === newRecordSlug ? `{0.${recordSlug.field}}` : null);

        if (newParam) {
          slugRedirect = populatePathname(pathname, {
            [recordSlug.param]: newParam,
          });
        }
      }
    }

    let result: ResultRecord | undefined;
    let error: Error | undefined;

    try {
      const queryOptions = {
        redirect: slugRedirect || registeredRedirect.current || undefined,
        database,
      };

      if (shouldSet) {
        result = await set[model](
          {
            with: typeof shouldSet === 'object' ? shouldSet : {},
            to: valuesNormalized,
            using: including,
          },
          queryOptions,
        );
      } else if (shouldRemove) {
        result = await remove[model](
          {
            with: typeof shouldRemove === 'object' ? shouldRemove : {},
            using: including,
          },
          queryOptions,
        );
      } else {
        result = await add[model](
          {
            with: valuesNormalized,
            // @ts-expect-error The types will be improved shortly.
            using: including,
          },
          queryOptions,
        );
      }
    } catch (err: unknown) {
      error = err as Error;

      // Unless the error was explicitly intentionally thrown by manually written code
      // inside a trigger, we want to log it here, to avoid cases where errors aren't
      // seen because a page might not yet handle form submission errors correctly.
      if (!(error instanceof TriggerError)) console.error(error);
    }

    setWaiting(false);

    if (result) {
      setResult({ value: result, updatedAt: currentTime });
      if (onSuccess) onSuccess(result);

      // Reset the fields of all registered forms if `clearOnSuccess` is set.
      if (clearOnSuccess) clearForms();
    } else if (error) {
      setResult({ error, updatedAt: currentTime });
      if (onError) onError(error);
    }
  };

  const clearForms = () => {
    Object.values(forms.current).map((form) => form.reset());
  };

  const reset = (clearFields?: true) => {
    setWaiting(false);
    setResult(null);

    if (clearFields) clearForms();
  };

  const registerProperty = (
    name: string,
    type: RegisteredProperty['type'],
    getValue: RegisteredProperty['getValue'],
  ) => {
    registeredProperties.current[name] = { type, getValue };
  };

  const unregisterProperty = (name: string) => {
    delete registeredProperties.current[name];
  };

  const registerRedirect = (destination: string) => {
    registeredRedirect.current = destination;
  };

  const unregisterRedirect = () => {
    registeredRedirect.current = null;
  };

  // If the provided `redirect` prop changes, update the registered redirect.
  useEffect(() => {
    registeredRedirect.current = redirect || null;
  }, [redirect]);

  const key = [
    model,
    typeof shouldSet === 'object' ? JSON.stringify(shouldSet) : '',
    typeof shouldRemove === 'object' ? JSON.stringify(shouldRemove) : '',
  ].join('');

  return (
    <FormContext.Provider
      value={{
        key,

        waiting,
        disabled,
        clearOnSuccess,

        result: result?.value || null,
        error: result?.error || null,
        updatedAt: result?.updatedAt || null,

        submit,
        reset,

        registerProperty,
        unregisterProperty,
        registerRedirect,
        unregisterRedirect,
        registerForm,
        unregisterForm,
      }}>
      {noElement ? children : <FormElement>{children}</FormElement>}
    </FormContext.Provider>
  );
};

wrapClientComponent(Form, 'Form');

export { Form };
