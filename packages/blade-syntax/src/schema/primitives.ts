import { type SyntaxItem, getSyntaxProxy } from '@/src/queries';
import type { ModelField } from 'blade-compiler';

/** A utility type that maps an attribute's type to a function signature. */
type AttributeSignature<T, Attribute> = T extends boolean
  ? () => any
  : Attribute extends keyof Omit<ModelFieldExpressions<T>, 'type' | 'slug'>
    ? ModelFieldExpressions<T>[Attribute]
    : never;

/**
 * Represents a chain of field attributes in the form of a function chain.
 *
 * - `Attrs`: The interface describing your attributes (e.g., { required: boolean; }).
 * - `Used`: A union of the keys already used in the chain.
 *
 * For each attribute key `K` not in `Used`, create a method using the signature derived
 * from that attribute's type. Calling it returns a new `Chain` marking `K` as used.
 */
export type Chain<Attrs, Used extends keyof Attrs = never> = {
  // 1) Chainable methods for all keys that are not in `Used` or `type`
  [K in Exclude<keyof Attrs, Used | 'type'>]: (
    // @ts-expect-error: This is a valid use case.
    ...args: Array<AttributeSignature<TypeToTSType<Attrs['type']>, K>>
  ) => Chain<Attrs, Used | K>;
  // 2) If `type` is defined in `Attrs`, add it as a read-only property
} & ('type' extends keyof Attrs
  ? {
      readonly required: boolean;
      readonly type: Attrs['type'];
    }
  : object);

type TypeToTSType<Type> = Type extends 'string'
  ? string
  : Type extends 'number'
    ? number
    : Type extends 'boolean'
      ? boolean
      : Type extends 'blob'
        ? Blob
        : Type extends 'date'
          ? Date
          : object;

type FieldInput<Type extends ModelField['type']> = Partial<
  Omit<ModelField, keyof ModelFieldExpressions<TypeToTSType<Type>>> &
    Extract<ModelField, { type: 'link' }> &
    ModelFieldExpressions<TypeToTSType<Type>>
>;

export type FieldOutput<Type extends ModelField['type']> = Omit<
  Extract<ModelField & ModelFieldExpressions<TypeToTSType<Type>>, { type: Type }>,
  'slug' | 'system'
>;

export type ModelFieldExpressions<Type> = {
  check?: (fields: Record<string, Type>) => Type;
  computedAs?: (fields: Record<string, Type>) => {
    value: Type;
    kind: 'VIRTUAL' | 'STORED';
  };
  defaultValue?: (() => Type) | Type;
};

export type SyntaxField<Type extends ModelField['type']> = SyntaxItem<FieldOutput<Type>> &
  any;

/**
 * Creates a primitive field definition returning an object that includes the field type
 * and attributes.
 *
 * @param type - The field type.
 *
 * @returns A field of the provided type with the specified attributes.
 */
const primitive = <T extends ModelField['type']>(type: T) => {
  return (initialAttributes: FieldInput<T> = {}) => {
    return getSyntaxProxy({ propertyValue: true })({
      ...initialAttributes,
      type,
    }) as unknown as Chain<FieldOutput<T>>;
  };
};

/**
 * Creates a string field definition returning an object that includes the field type
 * ("string") and attributes.
 *
 * @example
 * ```ts
 * import { model, string } from 'ronin/schema';
 *
 * const User = model({
 *  slug: 'user',
 *
 *  fields: {
 *    name: string(),
 *    email: string({ required: true, unique: true })
 *  },
 * });
 * ```
 *
 * @param attributes - Optional field attributes.
 *
 * @returns A field of type "string" with the specified attributes.
 */
export const string = primitive('string');

/**
 * Creates a number field definition returning an object that includes the field type
 * ("number") and attributes.
 *
 * @example
 * ```ts
 * import { model, number } from 'ronin/schema';
 *
 * const User = model({
 *  slug: 'user',
 *
 *  fields: {
 *    points: number(),
 *    numReferrals: number({ defaultValue: 0 })
 *  },
 * });
 * ```
 *
 * @param attributes - Optional field attributes.
 *
 * @returns A field of type "number" with the specified attributes.
 */
export const number = primitive('number');

/**
 * Creates a link field definition returning an object that includes the field type
 * ("link") and attributes.
 *
 * @example
 * ```ts
 * import { model, link } from 'ronin/schema';
 *
 * const User = model({
 *  slug: 'user',
 *
 *  fields: {
 *    account: link({ target: 'account' }),
 *    posts: link({ target: 'post', kind: 'many', required: true })
 *  },
 * });
 * ```
 *
 * @param attributes - Optional field attributes.
 *
 * @returns A field of type "link" with the specified attributes.
 */
export const link = primitive('link');

/**
 * Creates a JSON field definition returning an object that includes the field type
 * ("json") and attributes.
 *
 * @example
 * ```ts
 * import { model, json } from 'ronin/schema';
 *
 * const User = model({
 *  slug: 'user',
 *
 *  fields: {
 *    settings: json()
 *  },
 * });
 * ```
 *
 * @param attributes - Optional field attributes.
 *
 * @returns A field of type "json" with the specified attributes.
 */
export const json = primitive('json');

/**
 * Creates a date field definition returning an object that includes the field type
 * ("date") and attributes.
 *
 * @example
 * ```ts
 * import { model, date } from 'ronin/schema';
 *
 * const User = model({
 *  slug: 'user',
 *
 *  fields: {
 *    lastActiveAt: date(),
 *    deactivatedAt: date({ defaultValue: null })
 *  },
 * });
 * ```
 *
 * @param attributes - Optional field attributes.
 *
 * @returns A field of type "date" with the specified attributes.
 */
export const date = primitive('date');

/**
 * Creates a boolean field definition returning an object that includes the field type
 * ("boolean") and attributes.
 *
 * @example
 * ```ts
 * import { model, boolean } from 'ronin/schema';
 *
 * const User = model({
 *  slug: 'user',
 *
 *  fields: {
 *    earlyAccess: boolean(),
 *    isVerified: boolean({ defaultValue: false, required: true })
 *  },
 * });
 * ```
 *
 * @param attributes - Optional field attributes.
 *
 * @returns A field of type "boolean" with the specified attributes.
 */
export const boolean = primitive('boolean');

/**
 * Creates a blob field definition returning an object that includes the field type
 * ("blob") and attributes.
 *
 * @example
 * ```ts
 * import { model, blob } from 'ronin/schema';
 *
 * const User = model({
 *  slug: 'user',
 *
 *  fields: {
 *    avatar: blob(),
 *    contents: blob({ required: true })
 *  },
 * });
 * ```
 *
 * @param attributes - Optional field attributes.
 *
 * @returns A field of type "blob" with the specified attributes.
 */
export const blob = primitive('blob');
