import type { TFieldEvaluated, TFnScope } from "@atscript/ui-fns";
import { getByPath as _getByPath, setByPath as _setByPath } from "@atscript/ui-core";
import type { TFormState } from "./types";
import { computed, inject, provide, type ComputedRef } from "vue";
import type { TAsUnionContext } from "../components/types";

const EMPTY_PREFIX = computed(() => "");

/**
 * Unified injection composable for as-* components.
 * Consolidates `__as_form`, `__as_root_data`, and `__as_path_prefix`
 * into a single call with shared helpers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormContext<TFormData = any, TFormContext = any>(componentName: string) {
  // ── Form state (with throw guard) ─────────────────────────
  const _formState = inject<TFormState>("__as_form");
  if (!_formState) {
    throw new Error(`${componentName} must be used inside an AsForm component`);
  }
  const formState = _formState;

  // ── Root form data ─────────────────────────────────────────
  const rootData = inject<ComputedRef<TFormData>>("__as_root_data");
  if (!rootData) {
    throw new Error(`${componentName} must be used inside an AsForm component (missing root data)`);
  }
  const rootFormData = () => rootData.value as Record<string, unknown>;

  // ── Path prefix ───────────────────────────────────────────
  const pathPrefix = inject<ComputedRef<string>>("__as_path_prefix", EMPTY_PREFIX);

  // ── Form context (separate injection — decoupled from formState) ──
  const _formContext = inject<ComputedRef<TFormContext | undefined>>("__as_form_context");
  const formContext = computed(() => (_formContext?.value ?? {}) as Record<string, unknown>);

  // ── Path-join utility (reactive — returns ComputedRef) ────
  function joinPath(segment: string | (() => string)): ComputedRef<string> {
    return computed(() => {
      const s = typeof segment === "function" ? segment() : segment;
      if (!s) return pathPrefix.value;
      return pathPrefix.value ? `${pathPrefix.value}.${s}` : s;
    });
  }

  // ── Path-build utility (non-reactive — plain function) ───
  function buildPath(segment: string): string {
    if (!segment) return pathPrefix.value;
    return pathPrefix.value ? `${pathPrefix.value}.${segment}` : segment;
  }

  // ── Path-aware data access (closure over rootFormData) ──────
  function getByPath(path: string): unknown {
    return _getByPath(rootFormData(), path);
  }

  function setByPath(path: string, value: unknown): void {
    _setByPath(rootFormData(), path, value);
  }

  // ── Scope builder ───────────────────────────────────────────
  function buildScope(v?: unknown, entry?: TFieldEvaluated): TFnScope {
    const rd = rootFormData();
    return { v, data: rd.value as Record<string, unknown>, context: formContext.value, entry };
  }

  return {
    formState,
    rootFormData,
    pathPrefix,
    formContext,
    joinPath,
    buildPath,
    getByPath,
    setByPath,
    buildScope,
  };
}

/**
 * Consume and clear the `__as_union` injection.
 *
 * Structured components (object, tuple, array, field-shell) call this to
 * read the union context provided by `AsUnion` and immediately clear it
 * so nested children don't inherit it.
 */
export function useConsumeUnionContext(): TAsUnionContext | undefined {
  const unionCtx = inject<TAsUnionContext | undefined>("__as_union", undefined);
  provide("__as_union", undefined);
  return unionCtx;
}

/**
 * Format a label/title with an array-index prefix.
 *
 * When `arrayIndex` is defined, prepends `#<index+1>` to the label.
 * Used by field-shell (label) and object (title) components for array items.
 */
export function formatIndexedLabel(
  label: string | undefined,
  arrayIndex: number | undefined,
): string | undefined {
  if (arrayIndex !== undefined) {
    return label ? `${label} #${arrayIndex + 1}` : `#${arrayIndex + 1}`;
  }
  return label;
}
