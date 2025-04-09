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
  GetHook as OriginalGetHook,
  PostAddHook as OriginalPostAddHook,
  PostCountHook as OriginalPostCountHook,
  PostGetHook as OriginalPostGetHook,
  PostRemoveHook as OriginalPostRemoveHook,
  PostSetHook as OriginalPostSetHook,
  RemoveHook as OriginalRemoveHook,
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
    siteName?: string;
    images?: { url: string; width: number; height: number }[];
  };
  x?: {
    card?: string;
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

export type CountHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalCountHook<TSchema>>>
) => ReturnType<OriginalCountHook<TSchema>>;
export type AddHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAddHook<TSchema>>>
) => ReturnType<OriginalAddHook<TSchema>>;
export type RemoveHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalRemoveHook<TSchema>>>
) => ReturnType<OriginalRemoveHook<TSchema>>;
export type GetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalGetHook<TSchema>>>
) => ReturnType<OriginalGetHook<TSchema>>;
export type SetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalSetHook<TSchema>>>
) => ReturnType<OriginalSetHook<TSchema>>;

export type PostCountHook = (
  ...args: Parameters<AddOptionsArgument<OriginalPostCountHook>>
) => ReturnType<OriginalPostCountHook>;
export type PostAddHook = (
  ...args: Parameters<AddOptionsArgument<OriginalPostAddHook>>
) => ReturnType<OriginalPostAddHook>;
export type PostRemoveHook = (
  ...args: Parameters<AddOptionsArgument<OriginalPostRemoveHook>>
) => ReturnType<OriginalPostRemoveHook>;
export type PostGetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalPostGetHook>>
) => ReturnType<OriginalPostGetHook>;
export type PostSetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalPostSetHook>>
) => ReturnType<OriginalPostSetHook>;

export type AfterCountHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterCountHook<TSchema>>>
) => ReturnType<OriginalAfterCountHook<TSchema>>;
export type AfterAddHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterAddHook<TSchema>>>
) => ReturnType<OriginalAfterAddHook<TSchema>>;
export type AfterRemoveHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterRemoveHook<TSchema>>>
) => ReturnType<OriginalAfterRemoveHook<TSchema>>;
export type AfterGetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterGetHook<TSchema>>>
) => ReturnType<OriginalAfterGetHook<TSchema>>;
export type AfterSetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterSetHook<TSchema>>>
) => ReturnType<OriginalAfterSetHook<TSchema>>;

export type DataHooks<TSchema = unknown> = Record<
  string,
  BeforeGetHook | GetHook<TSchema> | AfterGetHook<TSchema>
>;

export type DataHooksList<TSchema = unknown> = Record<string, DataHooks<TSchema>>;
