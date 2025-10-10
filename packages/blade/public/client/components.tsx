import type { ModelField, StoredObject } from 'blade-compiler';
import { assign, construct, dash } from 'radash';
import {
  type AnchorHTMLAttributes,
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

interface LinkURL extends Omit<Partial<InstanceType<typeof URL>>, 'search'> {
  search?: string | Record<string, string | number | boolean | null>;
}

/**
 * Normalizes a `LinkURL` object to a `URL` instance.
 *
 * @param url - The `LinkURL` or `URL` object to normalize.
 * @param currentURL - The currently active URL.
 *
 * @returns A new `URL` instance.
 */
const normalizeURL = (url: LinkURL, currentURL: string) => {
  if (url instanceof URL) return url;

  const newURL = new URL(currentURL);

  for (const [key, value] of Object.entries(url)) {
    switch (key) {
      case 'search':
        // If the provided query parameters are serialized as a string, we can just
        // assign them to the final URL without any modifications.
        if (typeof url.search === 'string') {
          newURL.search = url.search;
          // If the provided query parameters are an object, however, we need to
          // explicitly convert them into a string.
        } else if (url.search) {
          // Filter out query parameters with `undefined` or `null` values. It's
          // important to filter out `null` because `location.searchParams` exposes query
          // params as `null` if they're empty, and `normalizeURL` should be able to
          // accept query params that were retrieved from `location.searchParams`.
          const params = Object.entries(url.search).filter(([, value]) => {
            return typeof value !== 'undefined' && value !== null;
          }) as [string, string][];

          // Generate and assign a new string of query parameters.
          newURL.search = new URLSearchParams(params).toString();
        }
        break;
      case 'hash':
      case 'host':
      case 'hostname':
      case 'href':
      case 'password':
      case 'pathname':
      case 'port':
      case 'protocol':
      case 'username':
        newURL[key] = value;
    }
  }

  return newURL;
};

/**
 * Get the pathname (including query parameters) of a URL.
 *
 * @param url - The URL to compose the pathname for.
 *
 * @returns The pathname (including query parameters) of the provided URL.
 */
const getPathFromURL = (url: LinkURL, currentURL: string) => {
  const normalized = normalizeURL(url, currentURL);
  return normalized.pathname + normalized.search;
};

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  children: ReactNode;
  href: string | LinkURL;
  segments?: Record<string, string | Array<string>>;
  prefetch?: boolean;
}

const Link = ({
  href: hrefDefault,
  segments,
  children,
  prefetch = true,
  ...extraProps
}: LinkProps) => {
  const universalContext = useUniversalContext();

  const href =
    typeof hrefDefault === 'string'
      ? hrefDefault
      : getPathFromURL(hrefDefault, universalContext.url);

  const populatePathname = usePopulatePathname();
  const destination = populatePathname(href, segments);
  const linkEventHandlers = useLinkEvents(destination);

  const shouldPrefetch =
    prefetch &&
    !(destination.startsWith('https://') || destination.startsWith('http://'));

  const eventHandlers = shouldPrefetch
    ? linkEventHandlers
    : { onClick: linkEventHandlers.onClick };

  const anchorProps = {
    href: destination,
    ...eventHandlers,
    ...extraProps,

    // We must pass `extraProps` after `linkEventHandlers`, to allow for overwriting the
    // default event handlers.
    //
    // However, simply deconstructing `extraProps` after deconstructing
    // `linkEventHandlers` would cause props within `extraProps` to overwrite the props
    // in `linkEventHandlers`, even if the props in `extraProps` contain the value
    // `undefined`. To protect against this, we are explicitly checking whether the value
    // is falsy before using it.
    onClick: extraProps.onClick || linkEventHandlers.onClick,
    onMouseEnter: extraProps.onMouseEnter || linkEventHandlers.onMouseEnter,
    onTouchStart: extraProps.onTouchStart || linkEventHandlers.onTouchStart,
  } satisfies AnchorHTMLAttributes<HTMLAnchorElement>;

  return <a {...anchorProps}>{children}</a>;
};

const supportedFitValues = ['fill', 'contain', 'cover'];

interface BaseImageProps {
  /**
   * Defines text that can replace the image in the page.
   */
  alt?: string;
  /**
   * The quality level at which the image should be displayed. A lower quality ensures a
   * faster loading speed, but might also effect the visual appearance, so it is
   * essential to choose carefully.
   *
   * Must be an integer between `0` and `100`.
   *
   * @default 80
   */
  quality?: number;
  /**
   * The format of the image.
   *
   * @default "webp"
   */
  format?: 'webp' | 'jpeg' | 'png' | 'original';
  /**
   * The value of a RONIN blob field.
   */
  src: string | StoredObject;
  /**
   * Specifies how the image should be resized to fit its container.
   *
   * @default "cover"
   */
  fit?: React.CSSProperties['objectFit'];
  /**
   * The aspect ratio of the image. Can be "square", "video", or a custom string.
   */
  aspect?: 'square' | 'video' | string;
  /**
   * Indicates how the browser should load the image.
   *
   * Providing the value "lazy" defers loading the image until it reaches a calculated
   * distance from the viewport, as defined by the browser. The intent is to avoid the
   * network and storage impact needed to handle the image until it's reasonably certain
   * that it will be needed. This generally improves the performance of the content in
   * most typical use cases.
   */
  loading?: 'lazy';
  /**
   * The class names for the image container (not the image itself).
   */
  className?: string;
  /**
   * The inline style for the image container (not the image itself).
   */
  style?: React.CSSProperties;
}

type ImageProps = BaseImageProps &
  (
    | {
        /**
         * The intrinsic size of the image in pixels, if its width and height are the same.
         * Must be an integer without a unit.
         */
        size: number;
        /**
         * The intrinsic width of the image in pixels. Must be an integer without a unit.
         */
        width?: never;
        /**
         * The intrinsic height of the image, in pixels. Must be an integer without a unit.
         */
        height?: never;
      }
    | {
        /**
         * The intrinsic size of the image in pixels, if its width and height are the same.
         * Must be an integer without a unit.
         */
        size?: never;
        /**
         * The intrinsic width of the image in pixels. Must be an integer without a unit.
         */
        width?: number;
        /**
         * The intrinsic height of the image, in pixels. Must be an integer without a unit.
         */
        height: number;
      }
    | {
        /**
         * The intrinsic size of the image in pixels, if its width and height are the same.
         * Must be an integer without a unit.
         */
        size?: never;
        /**
         * The intrinsic width of the image in pixels. Must be an integer without a unit.
         */
        width: number;
        /**
         * The intrinsic height of the image, in pixels. Must be an integer without a unit.
         */
        height?: number;
      }
  );

const Image = forwardRef<HTMLDivElement, ImageProps>(
  (
    {
      src: input,
      alt,
      size: defaultSize,
      width: defaultWidth,
      height: defaultHeight,
      fit = 'cover',
      format = 'webp',
      quality = 80,
      aspect,
      loading,
      style,
      className,
    },
    ref,
  ) => {
    const imageElement = useRef<HTMLImageElement | null>(null);
    const renderTime = useRef<number>(Date.now());

    const isMediaObject = typeof input === 'object' && input !== null;
    const width = defaultSize || defaultWidth;
    const height = defaultSize || defaultHeight;

    const onLoad = useCallback(() => {
      const duration = Date.now() - renderTime.current;
      const threshold = 150;

      // Fade in and gradually reduce blur of the real image if loading takes longer than
      // the specified threshold.
      if (duration > threshold) {
        imageElement.current?.animate(
          [
            { filter: 'blur(4px)', opacity: 0 },
            { filter: 'blur(0px)', opacity: 1 },
          ],
          {
            duration: 200,
          },
        );
      }
    }, []);

    if (!(height || width))
      throw new Error('Either `width`, `height`, or `size` must be defined for `Image`.');

    // Validate given `quality` property.
    if (quality && (quality < 0 || quality > 100))
      throw new Error('The given `quality` was not in the range between 0 and 100.');

    const optimizationParams = new URLSearchParams({
      ...(width ? { w: width.toString() } : {}),
      ...(height ? { h: height.toString() } : {}),
      ...(format !== 'original' ? { fm: format } : {}),

      fit: supportedFitValues.includes(fit) ? fit : 'cover',
      q: quality.toString(),
    });

    const responsiveOptimizationParams = new URLSearchParams({
      ...(width ? { h: (width * 2).toString() } : {}),
      ...(height ? { h: (height * 2).toString() } : {}),
      ...(format !== 'original' ? { fm: format } : {}),

      fit: supportedFitValues.includes(fit) ? fit : 'cover',
      q: quality.toString(),
    });

    const source = isMediaObject ? `${input.src}?${optimizationParams}` : input;

    const responsiveSource = isMediaObject
      ? `${input.src}?${optimizationParams} 1x, ` +
        `${input.src}?${responsiveOptimizationParams} 2x`
      : input;

    const placeholder =
      input && typeof input !== 'string' ? input.placeholder?.base64 : null;

    return (
      <div
        ref={ref}
        className={className}
        style={{
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          width: width || '100%',
          height: height || '100%',
          aspectRatio: aspect === 'video' ? '16/9' : aspect === 'square' ? '1/1' : 'auto',
          ...style,
        }}>
        {/* Blurred preview being displayed until the actual image is loaded. */}
        {placeholder && (
          // biome-ignore lint/nursery/noImgElement: An image component requires a `<img />` element.
          <img
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: fit,
            }}
            src={placeholder}
            alt={alt}
          />
        )}

        {/* The optimized image, responsive to the specified size. */}
        {/* biome-ignore lint/nursery/noImgElement: An image component requires a `<img />` element. */}
        <img
          alt={alt}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: fit,
          }}
          decoding="async"
          onLoad={onLoad}
          loading={loading}
          ref={imageElement}
          src={source}
          srcSet={responsiveSource}
        />
      </div>
    );
  },
);

type FieldType =
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

const normalizeValue = (
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
  key: string;
  submit: () => Promise<void>;
  waiting: boolean;
  clearOnSuccess: boolean;
  registerProperty: (
    name: string,
    type: RegisteredProperty['type'],
    getValue: RegisteredProperty['getValue'],
  ) => void;
  unregisterProperty: (name: string) => void;
  registerRedirect: (destination: string) => void;
  unregisterRedirect: () => void;
  result: unknown | null;
  error: TriggerError | null;
  updatedAt: Date | null;
  reset: (clearFields?: true) => void;
  registerForm: ({ current }: RegisterFormProps) => string;
  unregisterForm: (id: string) => void;
  disabled?: boolean;
};

type RegisteredProperty = {
  type: FieldType;
  getValue: () => void;
};

const FormContext = createContext<FormContextValue | null>(null);

interface FormProps extends PropsWithChildren {
  /** Properties for matching the target record that should be modified. */
  targetRecord?: Record<string, unknown> & Partial<ResultRecord>;
  /** The slug (singular) of the affected Blade model. */
  modelSlug: string;
  /** Called once the queries of the form have been executed successfully. */
  onSuccess?: (result: NonNullable<Result['value']>) => void;
  /** Called if one of the queries of the form fails to execute. */
  onError?: (error: Required<Result>['error']) => void;
  /**
   * Allows for redirecting to a page once the queries of the form have been
   * executed successfully. Redirects can also be registered by invoking the
   * `registerRedirect` method exposed by the context.
   */
  redirect?: string;
  /** Whether the form should be interactive, or not. */
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
}

interface Result {
  value?: ResultRecord;
  error?: TriggerError;
  updatedAt: Date;
}

const Form = ({
  targetRecord,
  modelSlug,
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
}: FormProps) => {
  const forms = useRef<Record<string, HTMLFormElement>>({});
  const { set, add } = useMutation();
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

        if (!isArrayField) values[key] = value;

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
      const normalizedValue = normalizeValue(value, type) as string | number | boolean;

      // If a field should be excluded from the final query if it's empty, we need to
      // prevent it from getting added to the final list of values.
      if (excludeEmptyFields?.includes(key) && normalizedValue === null) continue;

      if (isChildOfJSON) {
        // If the name of the field contains a dot, we know for a fact that it wants to
        // be nested into a JSON object.
        const expandable: Record<keyof typeof valuesNormalized, unknown> = {};
        expandable[key] = normalizedValue;

        // A basic `Object.assign` doesn't help here, because we need to deeply merge
        // both objects.
        valuesNormalized = assign(
          valuesNormalized,
          construct(expandable),
        ) as typeof valuesNormalized;
      } else if (isArray) {
        valuesNormalized[key] = values[key].map(
          (value: string | number | boolean | Date) => normalizeValue(value, type),
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

      if (targetRecord) {
        result = await set[modelSlug](
          {
            with: targetRecord,
            to: valuesNormalized,
            using: including,
          },
          queryOptions,
        );
      } else {
        result = await add[modelSlug](
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

  return (
    <FormContext.Provider
      value={{
        key: `${modelSlug}${targetRecord?.id ? `_${targetRecord.id}` : ''}`,

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
      {children}
    </FormContext.Provider>
  );
};

interface useSaveOptions {
  // Boolean indicating whether the saving shall be disabled.
  disabled?: boolean;
}

const useSave = ({ disabled = false }: useSaveOptions) => {
  const form = useContext(FormContext);

  // Listen to global ⌘+S events.
  useEffect(() => {
    const listener = async (event: KeyboardEvent) => {
      if (
        !disabled &&
        (window.navigator.userAgent.match('Mac') ? event.metaKey : event.ctrlKey) &&
        event.key === 's'
      ) {
        // Ignore default events.
        event.preventDefault();

        // Abort if `disabled` is set.
        if (disabled) return;

        // Abort if the form is already submitting.
        if (form?.waiting) return;

        // If no form controls were found, abort.
        if (!form) return;

        await form.submit();
      }
    };

    document.addEventListener('keydown', listener, false);
    return () => document.removeEventListener('keydown', listener);
  }, [disabled, form]);
};

interface FormFieldsProps extends PropsWithChildren {
  allowGlobalSave?: boolean;
}

// This component purely exists for the purpose of surrounding HTML input elements with
// an HTML form element in order to invoke JavaScript properties on the form and
// automatically read all its children fields like that. Please therefore refrain from
// adding any styling to it. As you can see in the places where the component is already
// used, it automatically adapts to its parent, especially when the parent is using flex.
const FormFields = ({ children, allowGlobalSave }: FormFieldsProps) => {
  const form = useContext(FormContext);
  if (!form) throw new Error('`Form` can only be used within `Form`.');

  const formId = useRef<string>('');
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    formId.current = form.registerForm(formRef as MutableRefObject<HTMLFormElement>);
    return () => form.unregisterForm(formId.current);
  }, []);

  // Allow ⌘+S to be used to submit the form.
  useSave({ disabled: !allowGlobalSave });

  return (
    <form
      id={form.key}
      onKeyDown={(event) => {
        /**
         * When the user presses Ctrl+Enter (or Cmd+Enter on macOS) while focused
         * on an input field, we want to submit the form.
         */
        const focusedTagName = document.activeElement?.tagName;
        if (!focusedTagName) return;

        const isClosestForm = event.currentTarget.id === form.key;
        if (!isClosestForm) return;

        const isFocusedOnInput = ['INPUT', 'TEXTAREA'].includes(focusedTagName);
        const isCtrlOrCmdKey = window.navigator.userAgent.match('Mac')
          ? event.metaKey
          : event.ctrlKey;

        // Boolean indicating whether the user wants to save their current changes.
        const saveIntent = isCtrlOrCmdKey && event.key === 'Enter';

        if (saveIntent && isFocusedOnInput && !form.waiting) {
          form.submit();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();

        // Only execute `submit` if the form is not already submitting.
        if (form?.submit && !form?.waiting) form.submit();
      }}
      ref={formRef}>
      {children}

      {/* Submit form when ENTER is pressed. */}
      <button
        hidden
        type="submit"
      />
    </form>
  );
};

interface HiddenValueProps {
  /** The name of the field in the Blade model. */
  name: string;
  /** The type of the field in the Blade model. */
  type: FieldType;
  /** The value to be stored for the field in the Blade model. */
  value?: string | number | boolean | object | null;
}

const HiddenValue = ({ name, type, value }: HiddenValueProps) => {
  let content: string | number;

  // Serialize boolean values.
  if (typeof value === 'boolean') {
    content = value.toString();
  }

  // Serialize `null` values.
  else if (value === null) {
    content = 'null';
  } else if (typeof value === 'object') {
    content = JSON.stringify(value);
  } else {
    content = value || '';
  }

  // We neither want the input to be visible to the eye, nor usable by accessibility
  // tools. We only want to make it possible for us to serialize the form data when
  // submitting it.
  return (
    <input
      aria-hidden
      // The type used when storing the value in SQLite.
      data-type={type}
      name={name}
      readOnly
      type="hidden"
      value={content}
    />
  );
};

wrapClientComponent(Link, 'Link');
wrapClientComponent(Image, 'Image');
wrapClientComponent(Form, 'Form');
wrapClientComponent(FormFields, 'FormFields');

// `HiddenValue` is not a client component.
// Neither is `FormContext`.

export { Link, Image, Form, FormFields, HiddenValue, FormContext };
