import type { Component, ComputedRef, InjectionKey } from "vue";
import type { TAsChangeType, TAsUnionContext } from "../components/types";
import type { TFormState } from "./types";

/**
 * Typed Vue provide/inject keys used across the form tree.
 *
 * Keys with generic value types (form data, form context) are intentionally
 * widened to `unknown` here — call sites cast to their concrete generic.
 * This is the standard Vue tradeoff for `InjectionKey<T>`: a key has one
 * concrete type, so the generic flexibility lives at the consumer.
 */

export const FORM_STATE_KEY: InjectionKey<TFormState> = Symbol("atui.form-state");
export const FORM_DATA_KEY: InjectionKey<ComputedRef<unknown>> = Symbol("atui.form-data");
export const FORM_CONTEXT_KEY: InjectionKey<ComputedRef<unknown>> = Symbol("atui.form-context");
export const ROOT_DATA_KEY: InjectionKey<ComputedRef<unknown>> = Symbol("atui.root-data");

export const PATH_PREFIX_KEY: InjectionKey<ComputedRef<string>> = Symbol("atui.path-prefix");
export const LEVEL_KEY: InjectionKey<ComputedRef<number>> = Symbol("atui.level");
export const HIDE_ROOT_TITLE_KEY: InjectionKey<boolean> = Symbol("atui.hide-root-title");

export const TYPES_KEY: InjectionKey<ComputedRef<Record<string, Component>>> = Symbol("atui.types");
export const COMPONENTS_KEY: InjectionKey<ComputedRef<Record<string, Component> | undefined>> =
  Symbol("atui.components");
export const ERRORS_KEY: InjectionKey<ComputedRef<Record<string, string | undefined> | undefined>> =
  Symbol("atui.errors");

export const ACTION_HANDLER_KEY: InjectionKey<(name: string) => void> =
  Symbol("atui.action-handler");
export const CHANGE_HANDLER_KEY: InjectionKey<
  (type: TAsChangeType, path: string, value: unknown) => void
> = Symbol("atui.change-handler");
// Per-keystroke external-error dismissal hook. Separate from
// CHANGE_HANDLER_KEY so the public `change` event stays a blur-committed
// signal while dismissal fires on every input/paste.
export const DISMISS_EXTERNAL_AT_KEY: InjectionKey<(path: string) => void> = Symbol(
  "atui.dismiss-external-at",
);

export const UNION_CONTEXT_KEY: InjectionKey<TAsUnionContext | undefined> =
  Symbol("atui.union-context");
