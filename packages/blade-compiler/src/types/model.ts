import type { Expression, GetInstructions, WithInstruction } from '@/src/types/query';

type ModelFieldCollation = 'BINARY' | 'NOCASE' | 'RTRIM';

export type ModelFieldLinkAction =
  | 'CASCADE'
  | 'RESTRICT'
  | 'SET NULL'
  | 'SET DEFAULT'
  | 'NO ACTION';

type ModelFieldBasics = {
  /** The label that should be used when displaying the field on the RONIN dashboard. */
  name?: string;
  /** Allows for addressing the field programmatically. */
  slug: string;
  /**
   * If set, only one record of the same model will be allowed to exist with a given
   * value for the field.
   */
  unique?: boolean;
  /**
   * Whether a value must be provided for the field. If this attribute is set and no
   * value is provided, an error will be thrown.
   */
  required?: boolean;
  /**
   * The value that should be inserted into the field in the case that no value was
   * explicitly provided for it when a record is created.
   */
  defaultValue?: Expression | unknown;
  /**
   * An expression that should be evaluated to form the value of the field. The
   * expression can either be VIRTUAL (evaluated whenever a record is read) or STORED
   * (evaluated whenever a record is created or updated).
   */
  computedAs?: {
    kind: 'VIRTUAL' | 'STORED';
    value: Expression;
  };
  /** An expression that gets evaluated every time a value is provided for the field. */
  check?: Expression;
  /** Whether the field was automatically added by RONIN. */
  system?: boolean;
};

// We have to list the types separately, in order for `Extract` to work.
export type ModelField = ModelFieldBasics &
  (
    | {
        /** The kind of value that should be stored inside the field. */
        type?: never;
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'boolean';
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'date';
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'json';
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'blob';
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'string';
        /** The collation sequence to use for the field value. */
        collation?: ModelFieldCollation;
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'number';
        /**
         * Automatically increments the value of the field with every new inserted record.
         */
        increment?: boolean;
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'link';
        /** The target model of the relationship that is being established. */
        target: string;
        /** Whether the field should be related to one record, or many records. */
        kind?: 'one';
        /**
         * If the target record is updated or deleted, the defined actions maybe executed.
         */
        actions?: {
          onDelete?: ModelFieldLinkAction;
          onUpdate?: ModelFieldLinkAction;
        };
      }
    | {
        /** The kind of value that should be stored inside the field. */
        type: 'link';
        /** The target model of the relationship that is being established. */
        target: string;
        /** Whether the field should be related to one record, or many records. */
        kind: 'many';
      }
  );

/** An extended version of `ModelField`, for internal use within the compiler. */
export type InternalModelField = ModelField & {
  /** The path on the final record where the value of the field should be mounted. */
  mountingPath: string;
  /** A custom value that was provided in the query, which is not stored in the DB. */
  mountedValue?: unknown;
  /** If this is set, the field is used during formatting, but not exposed afterward. */
  excluded?: boolean;
};

export type ModelIndexField<
  T extends ModelEntityList<ModelField> = ModelEntityList<ModelField>,
> = {
  /** The collating sequence used for text placed inside the field. */
  collation?: ModelFieldCollation;
  /** How the records in the index should be ordered. */
  order?: 'ASC' | 'DESC';
} & (
  | {
      /** The field slug for which the index should be created. */
      slug: keyof T;
    }
  | {
      /** The field expression for which the index should be created. */
      expression: string;
    }
);

export type ModelIndex<
  T extends ModelEntityList<ModelField> = ModelEntityList<ModelField>,
> = {
  /**
   * The list of fields in the model for which the index should be created.
   */
  fields: [ModelIndexField<T>, ...Array<ModelIndexField<T>>];
  /**
   * The identifier of the index.
   */
  slug: string;
  /**
   * Whether only one record with a unique value for the provided fields will be allowed.
   */
  unique?: boolean;
  /**
   * An object containing query instructions that will be used to match the records that
   * should be included in the index.
   */
  filter?: WithInstruction;
};

export type ModelPreset = {
  /** The visual display name of the preset. */
  name?: string;
  /** The identifier that can be used for adding the preset to a query. */
  slug: string;
  /** The query instructions that should be applied when the preset is used. */
  instructions: GetInstructions;
  /** Whether the preset was automatically added by RONIN. */
  system?: boolean;
};

export type ModelEntity = ModelField | ModelIndex | ModelPreset;

export type ModelEntityList<T extends { slug: string }> = Record<
  NonNullable<T['slug']>,
  T extends infer U ? Omit<U, 'slug'> : never
>;

export interface Model<
  T extends ModelEntityList<ModelField> = ModelEntityList<ModelField>,
> {
  id: string;

  name: string;
  pluralName: string;
  slug: string;
  pluralSlug: string;

  identifiers: {
    name: keyof T;
    slug: keyof T;
  };
  idPrefix: string;

  /** The name of the table in SQLite. */
  table: string;
  /**
   * The table name to which the model was aliased. This will be set in the case that
   * multiple tables are being joined into one SQL statement.
   */
  tableAlias?: string;

  /**
   * Details that identify the model as a model that was automatically created by RONIN,
   * instead of being manually created by a developer.
   */
  system?: {
    /** The model that caused the system model to get created. */
    model: string | 'root';
    /**
     * If the model is used to associate two models with each other (in the case of
     * many-cardinality link fields), this property should contain the field slug to
     * which the associative model should be mounted on the source model.
     */
    associationSlug?: string;
  };

  // Fields are not optional for internal models, because internal models within the
  // compiler always at least contain the default fields. For models that are passed into
  // the compiler from the outside, the fields are optional, because the compiler will
  // add the default fields automatically, and those are enough to create a model.
  fields: T;
  indexes?: ModelEntityList<ModelIndex<T>>;
  presets?: ModelEntityList<ModelPreset>;
}

export type PartialModel = Omit<Partial<Model>, 'identifiers'> & {
  identifiers?: Partial<Model['identifiers']>;
};

// In models provided to the compiler, all settings are optional, except for the `slug`,
// which is the required bare minimum.
export type PublicModel<
  T extends ModelEntityList<ModelField> = ModelEntityList<ModelField>,
> = Omit<Partial<Model<T>>, 'slug' | 'identifiers' | 'system' | 'tableAlias'> & {
  slug: Required<Model['slug']>;

  // It should also be possible for models to only define one of the two identifiers,
  // since the missing one will be generated automatically.
  identifiers?: Partial<Model['identifiers']>;
};
