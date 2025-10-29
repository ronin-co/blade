import type { Toc } from '@stefanprobst/rehype-extract-toc';
import type {
  Trigger as ClientTrigger,
  TriggerOptions as ClientTriggerOptions,
  TriggerType as ClientTriggerType,
  Triggers as ClientTriggers,
} from 'blade-client/types';
import type { Model, QueryType } from 'blade-compiler';
import type { ComponentType, FunctionComponent } from 'react';

import type { ServerContext } from '@/private/server/context';
import type { CustomNavigator } from '@/private/universal/types/util';
import type { SetCookie } from '@/private/universal/utils';

export type WaitUntil = (promise: Promise<unknown>) => void;

export type TableOfContents = Toc;

export type TreeItem = {
  tableOfContents?: TableOfContents;
  components?: Record<string, ComponentType<unknown>>;
  default: FunctionComponent<{
    components?: Record<string, ComponentType<unknown>>;
    tableOfContents?: TableOfContents;
  }>;
};

export interface PageMetadata {
  title?: Set<string>;
  themeColor?: string;
  colorScheme?: 'light' | 'dark';
  description?: string;
  icon?: string;
  openGraph?: {
    title?: string;
    description?: string;
    siteName?: string;
    images?: { url: string; width: number; height: number }[];
  };
  x?: {
    title?: string;
    description?: string;
    card?: string;
    site?: string;
    creator?: string;
    images?: string[];
  };
  htmlClassName?: string;
  bodyClassName?: string;
}

export interface TriggerOptions<TType extends QueryType = QueryType, TSchema = unknown>
  extends ClientTriggerOptions<TType, TSchema> {
  /**
   * A list of cookies that are stored on the client.
   */
  cookies: ServerContext['cookies'];
  /**
   * Used for setting new cookies that should be stored on the client, updating existing
   * ones, or deleting existing ones.
   */
  setCookie: SetCookie<string | null>;
  /**
   * Details about the client that is accessing the application.
   */
  navigator: CustomNavigator;
  /**
   * The URL of the page for which the trigger is being executed.
   */
  location: URL;
  /**
   * Indicates whether the incoming query stems from a headless source, meaning the
   * application's browser client or REST API.
   *
   * In such cases, it is advised to validate the authority of the incoming query within
   * triggers, by performing permission validation.
   */
  headless: boolean;
}

export type RecursiveRequired<T> = {
  [P in keyof T]-?: RecursiveRequired<T[P]>;
};

export type ValueOf<T> = T[keyof T];

type ValuesAsUnion<T extends Record<PropertyKey, readonly unknown[]>> = {
  [K in keyof T]: NonNullable<T[K]>[number];
};

export type Trigger<
  TStage extends ClientTriggerType,
  TType extends QueryType,
  TSchema extends TStage extends 'before' | 'during' | 'after' ? never : unknown = never,
  TOptions extends object = TriggerOptions<TType>,
> = ClientTrigger<TStage, TType, TSchema, TOptions>;

export type Triggers<
  TType extends QueryType = QueryType,
  TSchema = unknown,
  TOptions extends object = TriggerOptions<TType, TSchema>,
> = ValuesAsUnion<ClientTriggers<TType, TSchema, TOptions>>;

export type TriggersList<TSchema = unknown> = Record<
  string,
  Triggers<QueryType, TSchema>
>;
export type PageList = Record<string, TreeItem | 'DIRECTORY'>;
export type ModelList = { 'index.ts'?: Record<string, Model> };
