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
export type ClientTriggerOptions = Parameters<
  import('blade-client/types').BeforeGetTrigger
>[2];

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

export type BeforeCountTrigger = BladeTrigger<
  import('blade-client/types').BeforeCountTrigger
>;
export type BeforeAddTrigger = BladeTrigger<
  import('blade-client/types').BeforeAddTrigger
>;
export type BeforeRemoveTrigger = BladeTrigger<
  import('blade-client/types').BeforeRemoveTrigger
>;
export type BeforeGetTrigger = BladeTrigger<
  import('blade-client/types').BeforeGetTrigger
>;
export type BeforeSetTrigger = BladeTrigger<
  import('blade-client/types').BeforeSetTrigger
>;

export type CountTrigger = BladeTrigger<import('blade-client/types').CountTrigger>;
export type AddTrigger = BladeTrigger<import('blade-client/types').AddTrigger>;
export type RemoveTrigger = BladeTrigger<import('blade-client/types').RemoveTrigger>;
export type GetTrigger = BladeTrigger<import('blade-client/types').GetTrigger>;
export type SetTrigger = BladeTrigger<import('blade-client/types').SetTrigger>;

export type AfterCountTrigger = BladeTrigger<
  import('blade-client/types').AfterCountTrigger
>;
export type AfterAddTrigger = BladeTrigger<import('blade-client/types').AfterAddTrigger>;
export type AfterRemoveTrigger = BladeTrigger<
  import('blade-client/types').AfterRemoveTrigger
>;
export type AfterGetTrigger = BladeTrigger<import('blade-client/types').AfterGetTrigger>;
export type AfterSetTrigger = BladeTrigger<import('blade-client/types').AfterSetTrigger>;

export type ResolvingCountTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').ResolvingCountTrigger<TSchema>
>;
export type ResolvingAddTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').ResolvingAddTrigger<TSchema>
>;
export type ResolvingRemoveTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').ResolvingRemoveTrigger<TSchema>
>;
export type ResolvingGetTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').ResolvingGetTrigger<TSchema>
>;
export type ResolvingSetTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').ResolvingSetTrigger<TSchema>
>;

export type FollowingCountTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').FollowingCountTrigger<TSchema>
>;
export type FollowingAddTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').FollowingAddTrigger<TSchema>
>;
export type FollowingRemoveTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').FollowingRemoveTrigger<TSchema>
>;
export type FollowingGetTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').FollowingGetTrigger<TSchema>
>;
export type FollowingSetTrigger<TSchema = unknown> = BladeTrigger<
  import('blade-client/types').FollowingSetTrigger<TSchema>
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
