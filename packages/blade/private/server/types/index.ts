import type {
  AfterTriggerHandler,
  BeforeTriggerHandler,
  DuringTriggerHandler,
  FollowingTriggerHandler,
  ResolvingTriggerHandler,
} from 'blade-client/types';
import type { ComponentType, FunctionComponent } from 'react';

import type { ServerContext } from '@/private/server/context';
import type { CustomNavigator } from '@/private/universal/types/util';
import type { Toc } from '@stefanprobst/rehype-extract-toc';

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

/** The original trigger options provided by the RONIN client. */
export type ClientTriggerOptions = Parameters<BeforeTriggerHandler<'get'>>[2];

export interface TriggerOptions extends ClientTriggerOptions {
  /**
   * A list of cookies that are stored on the client.
   */
  cookies: ServerContext['cookies'];
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
  /**
   * Triggers a full page re-render and streams the updated UI to the client.
   *
   * Optionally it takes an array of queries to use for the next page render.
   */
  flushSession: NonNullable<ServerContext['flushSession']>;
}

export type RecursiveRequired<T> = {
  [P in keyof T]-?: RecursiveRequired<T[P]>;
};

export type ValueOf<T> = T[keyof T];

export type BeforeCountTrigger = BeforeTriggerHandler<'count', TriggerOptions>;
export type BeforeAddTrigger = BeforeTriggerHandler<'add', TriggerOptions>;
export type BeforeRemoveTrigger = BeforeTriggerHandler<'remove', TriggerOptions>;
export type BeforeGetTrigger = BeforeTriggerHandler<'get', TriggerOptions>;
export type BeforeSetTrigger = BeforeTriggerHandler<'set', TriggerOptions>;

export type CountTrigger = DuringTriggerHandler<'count', TriggerOptions>;
export type AddTrigger = DuringTriggerHandler<'add', TriggerOptions>;
export type RemoveTrigger = DuringTriggerHandler<'remove', TriggerOptions>;
export type GetTrigger = DuringTriggerHandler<'get', TriggerOptions>;
export type SetTrigger = DuringTriggerHandler<'set', TriggerOptions>;

export type AfterCountTrigger = AfterTriggerHandler<'count', TriggerOptions>;
export type AfterAddTrigger = AfterTriggerHandler<'add', TriggerOptions>;
export type AfterRemoveTrigger = AfterTriggerHandler<'remove', TriggerOptions>;
export type AfterGetTrigger = AfterTriggerHandler<'get', TriggerOptions>;
export type AfterSetTrigger = AfterTriggerHandler<'set', TriggerOptions>;

export type ResolvingCountTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'count',
  TriggerOptions,
  TSchema
>;
export type ResolvingAddTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'add',
  TriggerOptions,
  TSchema
>;
export type ResolvingRemoveTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'remove',
  TriggerOptions,
  TSchema
>;
export type ResolvingGetTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'get',
  TriggerOptions,
  TSchema
>;
export type ResolvingSetTrigger<TSchema = unknown> = ResolvingTriggerHandler<
  'set',
  TriggerOptions,
  TSchema
>;

export type FollowingCountTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'count',
  TriggerOptions,
  TSchema
>;
export type FollowingAddTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'add',
  TriggerOptions,
  TSchema
>;
export type FollowingRemoveTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'remove',
  TriggerOptions,
  TSchema
>;
export type FollowingGetTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'get',
  TriggerOptions,
  TSchema
>;
export type FollowingSetTrigger<TSchema = unknown> = FollowingTriggerHandler<
  'set',
  TriggerOptions,
  TSchema
>;

export type Triggers<TSchema = unknown> = Record<
  string,
  | BeforeGetTrigger
  | GetTrigger
  | AfterGetTrigger
  | ResolvingGetTrigger<TSchema>
  | FollowingGetTrigger<TSchema>
>;

export type TriggersList<TSchema = unknown> = Record<string, Triggers<TSchema>>;
export type PageList = Record<string, TreeItem | 'DIRECTORY'>;
