import type { ComponentType, FunctionComponent } from 'react';
import type {
  AddEffect as OriginalAddEffect,
  AfterAddEffect as OriginalAfterAddEffect,
  AfterCountEffect as OriginalAfterCountEffect,
  AfterGetEffect as OriginalAfterGetEffect,
  AfterRemoveEffect as OriginalAfterRemoveEffect,
  AfterSetEffect as OriginalAfterSetEffect,
  BeforeAddEffect as OriginalBeforeAddEffect,
  BeforeCountEffect as OriginalBeforeCountEffect,
  BeforeGetEffect as OriginalBeforeGetEffect,
  BeforeRemoveEffect as OriginalBeforeRemoveEffect,
  BeforeSetEffect as OriginalBeforeSetEffect,
  CountEffect as OriginalCountEffect,
  FollowingAddEffect as OriginalFollowingAddEffect,
  FollowingCountEffect as OriginalFollowingCountEffect,
  FollowingGetEffect as OriginalFollowingGetEffect,
  FollowingRemoveEffect as OriginalFollowingRemoveEffect,
  FollowingSetEffect as OriginalFollowingSetEffect,
  GetEffect as OriginalGetEffect,
  RemoveEffect as OriginalRemoveEffect,
  ResolvingAddEffect as OriginalResolvingAddEffect,
  ResolvingCountEffect as OriginalResolvingCountEffect,
  ResolvingGetEffect as OriginalResolvingGetEffect,
  ResolvingRemoveEffect as OriginalResolvingRemoveEffect,
  ResolvingSetEffect as OriginalResolvingSetEffect,
  SetEffect as OriginalSetEffect,
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

export interface EffectOptions {
  /**
   * A list of cookies that are stored on the client.
   */
  cookies: ServerContext['cookies'];
  /**
   * Details about the client that is accessing the application.
   */
  navigator: CustomNavigator;
  /**
   * The URL of the page for which the effect is being executed.
   */
  location: URL;
  /**
   * Indicates whether the incoming query stems from a headless source, meaning the
   * application's browser client or REST API.
   *
   * In such cases, it is advised to validate the authority of the incoming query within
   * effects, by performing permission validation.
   */
  headless: boolean;
}

export type RecursiveRequired<T> = {
  [P in keyof T]-?: RecursiveRequired<T[P]>;
};

export type ValueOf<T> = T[keyof T];

type AddOptionsArgument<T> = T extends (...args: [...infer Rest, infer Last]) => infer R
  ? (...args: [...Rest, Last & EffectOptions]) => R
  : never;

export type BeforeCountEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeCountEffect>>
) => ReturnType<OriginalBeforeCountEffect>;
export type BeforeAddEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeAddEffect>>
) => ReturnType<OriginalBeforeAddEffect>;
export type BeforeRemoveEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeRemoveEffect>>
) => ReturnType<OriginalBeforeRemoveEffect>;
export type BeforeGetEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeGetEffect>>
) => ReturnType<OriginalBeforeGetEffect>;
export type BeforeSetEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalBeforeSetEffect>>
) => ReturnType<OriginalBeforeSetEffect>;

export type CountEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalCountEffect>>
) => ReturnType<OriginalCountEffect>;
export type AddEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalAddEffect>>
) => ReturnType<OriginalAddEffect>;
export type RemoveEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalRemoveEffect>>
) => ReturnType<OriginalRemoveEffect>;
export type GetEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalGetEffect>>
) => ReturnType<OriginalGetEffect>;
export type SetEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalSetEffect>>
) => ReturnType<OriginalSetEffect>;

export type AfterCountEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterCountEffect>>
) => ReturnType<OriginalAfterCountEffect>;
export type AfterAddEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterAddEffect>>
) => ReturnType<OriginalAfterAddEffect>;
export type AfterRemoveEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterRemoveEffect>>
) => ReturnType<OriginalAfterRemoveEffect>;
export type AfterGetEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterGetEffect>>
) => ReturnType<OriginalAfterGetEffect>;
export type AfterSetEffect = (
  ...args: Parameters<AddOptionsArgument<OriginalAfterSetEffect>>
) => ReturnType<OriginalAfterSetEffect>;

export type ResolvingCountEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingCountEffect<TSchema>>>
) => ReturnType<OriginalResolvingCountEffect<TSchema>>;
export type ResolvingAddEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingAddEffect<TSchema>>>
) => ReturnType<OriginalResolvingAddEffect<TSchema>>;
export type ResolvingRemoveEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingRemoveEffect<TSchema>>>
) => ReturnType<OriginalResolvingRemoveEffect<TSchema>>;
export type ResolvingGetEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingGetEffect<TSchema>>>
) => ReturnType<OriginalResolvingGetEffect<TSchema>>;
export type ResolvingSetEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalResolvingSetEffect<TSchema>>>
) => ReturnType<OriginalResolvingSetEffect<TSchema>>;

export type FollowingCountEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingCountEffect<TSchema>>>
) => ReturnType<OriginalFollowingCountEffect<TSchema>>;
export type FollowingAddEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingAddEffect<TSchema>>>
) => ReturnType<OriginalFollowingAddEffect<TSchema>>;
export type FollowingRemoveEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingRemoveEffect<TSchema>>>
) => ReturnType<OriginalFollowingRemoveEffect<TSchema>>;
export type FollowingGetEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingGetEffect<TSchema>>>
) => ReturnType<OriginalFollowingGetEffect<TSchema>>;
export type FollowingSetEffect<TSchema = unknown> = (
  ...args: Parameters<AddOptionsArgument<OriginalFollowingSetEffect<TSchema>>>
) => ReturnType<OriginalFollowingSetEffect<TSchema>>;

export type Effects<TSchema = unknown> = Record<
  string,
  | BeforeGetEffect
  | GetEffect
  | AfterGetEffect
  | ResolvingGetEffect<TSchema>
  | FollowingGetEffect<TSchema>
>;

export type EffectsList<TSchema = unknown> = Record<string, Effects<TSchema>>;
