import type {
  AddTrigger as OriginalAddTrigger,
  AfterAddTrigger as OriginalAfterAddTrigger,
  AfterCountTrigger as OriginalAfterCountTrigger,
  AfterGetTrigger as OriginalAfterGetTrigger,
  AfterRemoveTrigger as OriginalAfterRemoveTrigger,
  AfterSetTrigger as OriginalAfterSetTrigger,
  BeforeAddTrigger as OriginalBeforeAddTrigger,
  BeforeCountTrigger as OriginalBeforeCountTrigger,
  BeforeGetTrigger as OriginalBeforeGetTrigger,
  BeforeRemoveTrigger as OriginalBeforeRemoveTrigger,
  BeforeSetTrigger as OriginalBeforeSetTrigger,
  CountTrigger as OriginalCountTrigger,
  FollowingAddTrigger as OriginalFollowingAddTrigger,
  FollowingCountTrigger as OriginalFollowingCountTrigger,
  FollowingGetTrigger as OriginalFollowingGetTrigger,
  FollowingRemoveTrigger as OriginalFollowingRemoveTrigger,
  FollowingSetTrigger as OriginalFollowingSetTrigger,
  GetTrigger as OriginalGetTrigger,
  RemoveTrigger as OriginalRemoveTrigger,
  ResolvingAddTrigger as OriginalResolvingAddTrigger,
  ResolvingCountTrigger as OriginalResolvingCountTrigger,
  ResolvingGetTrigger as OriginalResolvingGetTrigger,
  ResolvingRemoveTrigger as OriginalResolvingRemoveTrigger,
  ResolvingSetTrigger as OriginalResolvingSetTrigger,
  SetTrigger as OriginalSetTrigger,
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
export type ClientTriggerOptions = Parameters<OriginalBeforeGetTrigger>[2];

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

export type BeforeCountTrigger = BladeTrigger<OriginalBeforeCountTrigger>;
export type BeforeAddTrigger = BladeTrigger<OriginalBeforeAddTrigger>;
export type BeforeRemoveTrigger = BladeTrigger<OriginalBeforeRemoveTrigger>;
export type BeforeGetTrigger = BladeTrigger<OriginalBeforeGetTrigger>;
export type BeforeSetTrigger = BladeTrigger<OriginalBeforeSetTrigger>;

export type CountTrigger = BladeTrigger<OriginalCountTrigger>;
export type AddTrigger = BladeTrigger<OriginalAddTrigger>;
export type RemoveTrigger = BladeTrigger<OriginalRemoveTrigger>;
export type GetTrigger = BladeTrigger<OriginalGetTrigger>;
export type SetTrigger = BladeTrigger<OriginalSetTrigger>;

export type AfterCountTrigger = BladeTrigger<OriginalAfterCountTrigger>;
export type AfterAddTrigger = BladeTrigger<OriginalAfterAddTrigger>;
export type AfterRemoveTrigger = BladeTrigger<OriginalAfterRemoveTrigger>;
export type AfterGetTrigger = BladeTrigger<OriginalAfterGetTrigger>;
export type AfterSetTrigger = BladeTrigger<OriginalAfterSetTrigger>;

export type ResolvingCountTrigger<TSchema = unknown> = BladeTrigger<
  OriginalResolvingCountTrigger<TSchema>
>;
export type ResolvingAddTrigger<TSchema = unknown> = BladeTrigger<
  OriginalResolvingAddTrigger<TSchema>
>;
export type ResolvingRemoveTrigger<TSchema = unknown> = BladeTrigger<
  OriginalResolvingRemoveTrigger<TSchema>
>;
export type ResolvingGetTrigger<TSchema = unknown> = BladeTrigger<
  OriginalResolvingGetTrigger<TSchema>
>;
export type ResolvingSetTrigger<TSchema = unknown> = BladeTrigger<
  OriginalResolvingSetTrigger<TSchema>
>;

export type FollowingCountTrigger<TSchema = unknown> = BladeTrigger<
  OriginalFollowingCountTrigger<TSchema>
>;
export type FollowingAddTrigger<TSchema = unknown> = BladeTrigger<
  OriginalFollowingAddTrigger<TSchema>
>;
export type FollowingRemoveTrigger<TSchema = unknown> = BladeTrigger<
  OriginalFollowingRemoveTrigger<TSchema>
>;
export type FollowingGetTrigger<TSchema = unknown> = BladeTrigger<
  OriginalFollowingGetTrigger<TSchema>
>;
export type FollowingSetTrigger<TSchema = unknown> = BladeTrigger<
  OriginalFollowingSetTrigger<TSchema>
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
