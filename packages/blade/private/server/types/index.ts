import type { Toc } from '@stefanprobst/rehype-extract-toc';
import type { TriggerOptions as ClientTriggerOptions } from 'blade-client/types';
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

export interface TriggerOptions<TType extends QueryType>
  extends ClientTriggerOptions<TType> {
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

export type BeforeTrigger<TType extends QueryType> = AddOptionsArgument<
  ClientBeforeTrigger<TType>
>;
export type DuringTrigger<TType extends QueryType> = AddOptionsArgument<
  ClientDuringTrigger<TType>
>;
export type AfterTrigger<TType extends QueryType> = AddOptionsArgument<
  ClientAfterTrigger<TType>
>;
export type ResolvingTrigger<
  TType extends QueryType,
  TSchema = unknown,
> = AddOptionsArgument<ClientResolvingTrigger<TType, TSchema>>;
export type FollowingTrigger<
  TType extends QueryType,
  TSchema = unknown,
> = AddOptionsArgument<ClientFollowingTrigger<TType, TSchema>>;

export type Triggers<TSchema = unknown> = {
  beforeGet?: BeforeTrigger<'get'>;
  beforeSet?: BeforeTrigger<'set'>;
  beforeAdd?: BeforeTrigger<'add'>;
  beforeRemove?: BeforeTrigger<'remove'>;
  beforeCount?: BeforeTrigger<'count'>;
  beforeCreate?: BeforeTrigger<'create'>;
  beforeAlter?: BeforeTrigger<'alter'>;
  beforeDrop?: BeforeTrigger<'drop'>;

  duringGet?: DuringTrigger<'get'>;
  duringSet?: DuringTrigger<'set'>;
  duringAdd?: DuringTrigger<'add'>;
  duringRemove?: DuringTrigger<'remove'>;
  duringCount?: DuringTrigger<'count'>;
  duringCreate?: DuringTrigger<'create'>;
  duringAlter?: DuringTrigger<'alter'>;
  duringDrop?: DuringTrigger<'drop'>;

  afterGet?: AfterTrigger<'get'>;
  afterSet?: AfterTrigger<'set'>;
  afterAdd?: AfterTrigger<'add'>;
  afterRemove?: AfterTrigger<'remove'>;
  afterCount?: AfterTrigger<'count'>;
  afterCreate?: AfterTrigger<'create'>;
  afterAlter?: AfterTrigger<'alter'>;
  afterDrop?: AfterTrigger<'drop'>;

  resolvingGet?: ResolvingTrigger<'get', TSchema>;
  resolvingSet?: ResolvingTrigger<'set', TSchema>;
  resolvingAdd?: ResolvingTrigger<'add', TSchema>;
  resolvingRemove?: ResolvingTrigger<'remove', TSchema>;
  resolvingCount?: ResolvingTrigger<'count', TSchema>;
  resolvingCreate?: ResolvingTrigger<'create', TSchema>;
  resolvingAlter?: ResolvingTrigger<'alter', TSchema>;
  resolvingDrop?: ResolvingTrigger<'drop', TSchema>;

  followingGet?: FollowingTrigger<'get', TSchema>;
  followingSet?: FollowingTrigger<'set', TSchema>;
  followingAdd?: FollowingTrigger<'add', TSchema>;
  followingRemove?: FollowingTrigger<'remove', TSchema>;
  followingCount?: FollowingTrigger<'count', TSchema>;
  followingCreate?: FollowingTrigger<'create', TSchema>;
  followingAlter?: FollowingTrigger<'alter', TSchema>;
  followingDrop?: FollowingTrigger<'drop', TSchema>;
};

export type TriggersList<TSchema = unknown> = Record<string, Triggers<TSchema>>;
export type PageList = Record<string, TreeItem | 'DIRECTORY'>;
export type ModelList = { 'index.ts'?: Record<string, Model> };
