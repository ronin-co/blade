import type { ComponentType, FunctionComponent } from 'react';
import type {
  AfterCountHook as OriginalAfterCountHook,
  AfterCreateHook as OriginalAfterCreateHook,
  AfterDropHook as OriginalAfterDropHook,
  AfterGetHook as OriginalAfterGetHook,
  AfterSetHook as OriginalAfterSetHook,
  BeforeCountHook as OriginalBeforeCountHook,
  BeforeCreateHook as OriginalBeforeCreateHook,
  BeforeDropHook as OriginalBeforeDropHook,
  BeforeGetHook as OriginalBeforeGetHook,
  BeforeSetHook as OriginalBeforeSetHook,
  CountHook as OriginalCountHook,
  CreateHook as OriginalCreateHook,
  DropHook as OriginalDropHook,
  GetHook as OriginalGetHook,
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
   * Indicates whether the incoming query stems from the RONIN dashboard instead of an
   * app that was configured for the space.
   *
   * Once data hooks are deployed to RONIN, this allows people to treat the RONIN
   * dashboard in a special way, such that data hooks expose all data for the RONIN
   * dashboard, but still limit what data gets exposed to apps.
   */
  fromRoninDashboard: boolean;
  /**
   * Indicates whether the incoming query stems from the REST API.
   */
  fromHeadlessAPI: boolean;
}

export type RecursiveRequired<T> = {
  [P in keyof T]-?: RecursiveRequired<T[P]>;
};

export type ValueOf<T> = T[keyof T];

type AddOptionsArgument<T> = T extends (...a: infer U) => infer R
  ? (...a: [...U, DataHookOptions]) => R
  : never;

export type BeforeCountHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeCountHook>>
) => ReturnType<OriginalBeforeCountHook>;
export type BeforeCreateHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeCreateHook>>
) => ReturnType<OriginalBeforeCreateHook>;
export type BeforeDropHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeDropHook>>
) => ReturnType<OriginalBeforeDropHook>;
export type BeforeGetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeGetHook>>
) => ReturnType<OriginalBeforeGetHook>;
export type BeforeSetHook = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeSetHook>>
) => ReturnType<OriginalBeforeSetHook>;

export type CountHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalCountHook<TSchema>>>
) => ReturnType<OriginalCountHook<TSchema>>;
export type CreateHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalCreateHook<TSchema>>>
) => ReturnType<OriginalCreateHook<TSchema>>;
export type DropHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalDropHook<TSchema>>>
) => ReturnType<OriginalDropHook<TSchema>>;
export type GetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalGetHook<TSchema>>>
) => ReturnType<OriginalGetHook<TSchema>>;
export type SetHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalSetHook<TSchema>>>
) => ReturnType<OriginalSetHook<TSchema>>;

export type AfterCountHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterCountHook<TSchema>>>
) => ReturnType<OriginalAfterCountHook<TSchema>>;
export type AfterCreateHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterCreateHook<TSchema>>>
) => ReturnType<OriginalAfterCreateHook<TSchema>>;
export type AfterDropHook<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterDropHook<TSchema>>>
) => ReturnType<OriginalAfterDropHook<TSchema>>;
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
