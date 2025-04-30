import type { ComponentType, FunctionComponent } from 'react';
import type {
  AddHook as OriginalAddHook,
  AfterAddHook as OriginalAfterAddHook,
  AfterCountHook as OriginalAfterCountHook,
  AfterGetHook as OriginalAfterGetHook,
  AfterRemoveHook as OriginalAfterRemoveHook,
  AfterSetHook as OriginalAfterSetHook,
  BeforeAddHook as OriginalBeforeAddHook,
  BeforeCountHook as OriginalBeforeCountHook,
  BeforeGetHook as OriginalBeforeGetHook,
  BeforeRemoveHook as OriginalBeforeRemoveHook,
  BeforeSetHook as OriginalBeforeSetHook,
  CountHook as OriginalCountHook,
  FollowingAddHook as OriginalFollowingAddHook,
  FollowingCountHook as OriginalFollowingCountHook,
  FollowingGetHook as OriginalFollowingGetHook,
  FollowingRemoveHook as OriginalFollowingRemoveHook,
  FollowingSetHook as OriginalFollowingSetHook,
  GetHook as OriginalGetHook,
  RemoveHook as OriginalRemoveHook,
  ResolvingAddHook as OriginalResolvingAddHook,
  ResolvingCountHook as OriginalResolvingCountHook,
  ResolvingGetHook as OriginalResolvingGetHook,
  ResolvingRemoveHook as OriginalResolvingRemoveHook,
  ResolvingSetHook as OriginalResolvingSetHook,
  SetHook as OriginalSetHook,
} from 'ronin/types';

import type { CustomNavigator } from '../../universal/types/util';
import type { ServerContext } from '../context';

export type TreeItem = {
  components?: Record<string, ComponentType<unknown>>;
  default: FunctionComponent<{
    records?: unknown;
    components?: Record<string, ComponentType<unknown>>;
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

export interface DataHookOptions {
  /**
   * A list of cookies that are stored on the client.
   */
  cookies: ServerContext['cookies'];
  /**
   * Details about the client that is accessing the application.
   */
  navigator: CustomNavigator;
  /**
   * The URL of the page for which the data hook is being executed.
   */
  location: URL;
  /**
   * Indicates whether the incoming query stems from a headless source, meaning the
   * application's browser client or REST API.
   *
   * In such cases, it is advised to validate the authority of the incoming query within
   * data hooks, by performing permission validation.
   */
  headless: boolean;
}

export type RecursiveRequired<T> = {
  [P in keyof T]-?: RecursiveRequired<T[P]>;
};

export type ValueOf<T> = T[keyof T];

type AddOptionsArgument<T> = T extends (...args: [...infer Rest, infer Last]) => infer R
  ? (...args: [...Rest, Last & DataHookOptions]) => R
  : never;

export type BeforeCountHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeCountHook>>
) => ReturnType<OriginalBeforeCountHook>;
export type BeforeAddHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeAddHook>>
) => ReturnType<OriginalBeforeAddHook>;
export type BeforeRemoveHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeRemoveHook>>
) => ReturnType<OriginalBeforeRemoveHook>;
export type BeforeGetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeGetHook>>
) => ReturnType<OriginalBeforeGetHook>;
export type BeforeSetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeSetHook>>
) => ReturnType<OriginalBeforeSetHook>;

export type CountHook = (
  ...args: Parameters<AddOptionsArgument<OriginalCountHook>>
) => ReturnType<OriginalCountHook>;
export type AddHook = (
  ...args: Parameters<AddOptionsArgument<OriginalAddHook>>
) => ReturnType<OriginalAddHook>;
export type RemoveHook = (
  ...args: Parameters<AddOptionsArgument<OriginalRemoveHook>>
) => ReturnType<OriginalRemoveHook>;
export type GetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalGetHook>>
) => ReturnType<OriginalGetHook>;
export type SetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalSetHook>>
) => ReturnType<OriginalSetHook>;

export type AfterCountHook = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterCountHook>>
) => ReturnType<OriginalAfterCountHook>;
export type AfterAddHook = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterAddHook>>
) => ReturnType<OriginalAfterAddHook>;
export type AfterRemoveHook = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterRemoveHook>>
) => ReturnType<OriginalAfterRemoveHook>;
export type AfterGetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterGetHook>>
) => ReturnType<OriginalAfterGetHook>;
export type AfterSetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterSetHook>>
) => ReturnType<OriginalAfterSetHook>;

export type ResolvingCountHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingCountHook<TSchema>>>
) => ReturnType<OriginalResolvingCountHook<TSchema>>;
export type ResolvingAddHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingAddHook<TSchema>>>
) => ReturnType<OriginalResolvingAddHook<TSchema>>;
export type ResolvingRemoveHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingRemoveHook<TSchema>>>
) => ReturnType<OriginalResolvingRemoveHook<TSchema>>;
export type ResolvingGetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingGetHook<TSchema>>>
) => ReturnType<OriginalResolvingGetHook<TSchema>>;
export type ResolvingSetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingSetHook<TSchema>>>
) => ReturnType<OriginalResolvingSetHook<TSchema>>;

export type FollowingCountHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingCountHook<TSchema>>>
) => ReturnType<OriginalFollowingCountHook<TSchema>>;
export type FollowingAddHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingAddHook<TSchema>>>
) => ReturnType<OriginalFollowingAddHook<TSchema>>;
export type FollowingRemoveHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingRemoveHook<TSchema>>>
) => ReturnType<OriginalFollowingRemoveHook<TSchema>>;
export type FollowingGetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingGetHook<TSchema>>>
) => ReturnType<OriginalFollowingGetHook<TSchema>>;
export type FollowingSetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingSetHook<TSchema>>>
) => ReturnType<OriginalFollowingSetHook<TSchema>>;

export type DataHooks<TSchema = unknown> = Record<
  string,
  | BeforeGetHook
  | GetHook
  | AfterGetHook
  | ResolvingGetHook<TSchema>
  | FollowingGetHook<TSchema>
>;

export type DataHooksList<TSchema = unknown> = Record<string, DataHooks<TSchema>>;
