import type { ComponentType, FunctionComponent } from 'react';
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
} from 'ronin/types';

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

type AddOptionsArgument<T> = T extends (...args: [...infer Rest, infer Last]) => infer R
  ? (...args: [...Rest, Last & TriggerOptions]) => R
  : never;

export type BeforeCountTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeCountTrigger>>
) => ReturnType<OriginalBeforeCountTrigger>;
export type BeforeAddTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeAddTrigger>>
) => ReturnType<OriginalBeforeAddTrigger>;
export type BeforeRemoveTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeRemoveTrigger>>
) => ReturnType<OriginalBeforeRemoveTrigger>;
export type BeforeGetTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeGetTrigger>>
) => ReturnType<OriginalBeforeGetTrigger>;
export type BeforeSetTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeSetTrigger>>
) => ReturnType<OriginalBeforeSetTrigger>;

export type CountTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalCountTrigger>>
) => ReturnType<OriginalCountTrigger>;
export type AddTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalAddTrigger>>
) => ReturnType<OriginalAddTrigger>;
export type RemoveTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalRemoveTrigger>>
) => ReturnType<OriginalRemoveTrigger>;
export type GetTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalGetTrigger>>
) => ReturnType<OriginalGetTrigger>;
export type SetTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalSetTrigger>>
) => ReturnType<OriginalSetTrigger>;

export type AfterCountTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterCountTrigger>>
) => ReturnType<OriginalAfterCountTrigger>;
export type AfterAddTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterAddTrigger>>
) => ReturnType<OriginalAfterAddTrigger>;
export type AfterRemoveTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterRemoveTrigger>>
) => ReturnType<OriginalAfterRemoveTrigger>;
export type AfterGetTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterGetTrigger>>
) => ReturnType<OriginalAfterGetTrigger>;
export type AfterSetTrigger = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterSetTrigger>>
) => ReturnType<OriginalAfterSetTrigger>;

export type ResolvingCountTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingCountTrigger<TSchema>>>
) => ReturnType<OriginalResolvingCountTrigger<TSchema>>;
export type ResolvingAddTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingAddTrigger<TSchema>>>
) => ReturnType<OriginalResolvingAddTrigger<TSchema>>;
export type ResolvingRemoveTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingRemoveTrigger<TSchema>>>
) => ReturnType<OriginalResolvingRemoveTrigger<TSchema>>;
export type ResolvingGetTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingGetTrigger<TSchema>>>
) => ReturnType<OriginalResolvingGetTrigger<TSchema>>;
export type ResolvingSetTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingSetTrigger<TSchema>>>
) => ReturnType<OriginalResolvingSetTrigger<TSchema>>;

export type FollowingCountTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingCountTrigger<TSchema>>>
) => ReturnType<OriginalFollowingCountTrigger<TSchema>>;
export type FollowingAddTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingAddTrigger<TSchema>>>
) => ReturnType<OriginalFollowingAddTrigger<TSchema>>;
export type FollowingRemoveTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingRemoveTrigger<TSchema>>>
) => ReturnType<OriginalFollowingRemoveTrigger<TSchema>>;
export type FollowingGetTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingGetTrigger<TSchema>>>
) => ReturnType<OriginalFollowingGetTrigger<TSchema>>;
export type FollowingSetTrigger<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingSetTrigger<TSchema>>>
) => ReturnType<OriginalFollowingSetTrigger<TSchema>>;

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
