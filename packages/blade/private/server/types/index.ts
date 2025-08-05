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

type BladeTrigger<T extends (...args: Array<any>) => any> = (
  ...args: Parameters<
    // Combine the last parameter of the original trigger function with `TriggerOptions`.
    T extends (...args: [...infer Rest, infer Last]) => infer R
      ? (...args: [...Rest, Last & TriggerOptions]) => R
      : never
  >
) => ReturnType<T>;

export type BeforeCountTrigger = BladeTrigger<BeforeTriggerHandler<'count'>>;
export type BeforeAddTrigger = BladeTrigger<BeforeTriggerHandler<'add'>>;
export type BeforeRemoveTrigger = BladeTrigger<BeforeTriggerHandler<'remove'>>;
export type BeforeGetTrigger = BladeTrigger<BeforeTriggerHandler<'get'>>;
export type BeforeSetTrigger = BladeTrigger<BeforeTriggerHandler<'set'>>;

export type CountTrigger = BladeTrigger<DuringTriggerHandler<'count'>>;
export type AddTrigger = BladeTrigger<DuringTriggerHandler<'add'>>;
export type RemoveTrigger = BladeTrigger<DuringTriggerHandler<'remove'>>;
export type GetTrigger = BladeTrigger<DuringTriggerHandler<'get'>>;
export type SetTrigger = BladeTrigger<DuringTriggerHandler<'set'>>;

export type AfterCountTrigger = BladeTrigger<AfterTriggerHandler<'count'>>;
export type AfterAddTrigger = BladeTrigger<AfterTriggerHandler<'add'>>;
export type AfterRemoveTrigger = BladeTrigger<AfterTriggerHandler<'remove'>>;
export type AfterGetTrigger = BladeTrigger<AfterTriggerHandler<'get'>>;
export type AfterSetTrigger = BladeTrigger<AfterTriggerHandler<'set'>>;

export type ResolvingCountTrigger<TSchema = unknown> = BladeTrigger<
  ResolvingTriggerHandler<'count', TSchema>
>;
export type ResolvingAddTrigger<TSchema = unknown> = BladeTrigger<
  ResolvingTriggerHandler<'add', TSchema>
>;
export type ResolvingRemoveTrigger<TSchema = unknown> = BladeTrigger<
  ResolvingTriggerHandler<'remove', TSchema>
>;
export type ResolvingGetTrigger<TSchema = unknown> = BladeTrigger<
  ResolvingTriggerHandler<'get', TSchema>
>;
export type ResolvingSetTrigger<TSchema = unknown> = BladeTrigger<
  ResolvingTriggerHandler<'set', TSchema>
>;

export type FollowingCountTrigger<TSchema = unknown> = BladeTrigger<
  FollowingTriggerHandler<'count', TSchema>
>;
export type FollowingAddTrigger<TSchema = unknown> = BladeTrigger<
  FollowingTriggerHandler<'add', TSchema>
>;
export type FollowingRemoveTrigger<TSchema = unknown> = BladeTrigger<
  FollowingTriggerHandler<'remove', TSchema>
>;
export type FollowingGetTrigger<TSchema = unknown> = BladeTrigger<
  FollowingTriggerHandler<'get', TSchema>
>;
export type FollowingSetTrigger<TSchema = unknown> = BladeTrigger<
  FollowingTriggerHandler<'set', TSchema>
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
