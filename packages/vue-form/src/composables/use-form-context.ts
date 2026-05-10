import type { TFieldEvaluated, TFnScope } from "@atscript/ui-fns";
import { getByPath as _getByPath, setByPath as _setByPath } from "@atscript/ui";
import type { TFormState } from "./types";
import { computed, inject, provide, type ComputedRef } from "vue";
import {
  FORM_CONTEXT_KEY,
  FORM_STATE_KEY,
  PATH_PREFIX_KEY,
  ROOT_DATA_KEY,
  UNION_CONTEXT_KEY,
} from "./internal-keys";
import type { TAsUnionContext } from "../components/types";

const EMPTY_PREFIX = computed(() => "");

/**
 * Unified injection composable for as-* components. Consolidates form
 * state, root data, and path prefix into a single call with shared
 * helpers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormContext<TFormData = any, TFormContext = any>(componentName: string) {
  // ── Form state (with throw guard) ─────────────────────────
  const _formState = inject(FORM_STATE_KEY);
  if (!_formState) {
    throw new Error(`${componentName} must be used inside an AsForm component`);
  }
  const formState: TFormState = _formState;

  // ── Root form data ─────────────────────────────────────────
  const rootData = inject(ROOT_DATA_KEY) as ComputedRef<TFormData> | undefined;
  if (!rootData) {
    throw new Error(`${componentName} must be used inside an AsForm component (missing root data)`);
  }
  const rootFormData = () => rootData.value as Record<string, unknown>;

  // ── Path prefix ───────────────────────────────────────────
  const pathPrefix = inject(PATH_PREFIX_KEY, EMPTY_PREFIX);

  // ── Form context (separate injection — decoupled from formState) ──
  const _formContext = inject(FORM_CONTEXT_KEY) as
    | ComputedRef<TFormContext | undefined>
    | undefined;
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
 * Consume and clear the union context injection.
 *
 * Structured components (object, tuple, array, field-shell) call this to
 * read the union context provided by `AsUnion` and immediately clear it
 * so nested children don't inherit it.
 */
export function useAsUnionVariant(): TAsUnionContext | undefined {
  const unionCtx = inject(UNION_CONTEXT_KEY, undefined);
  provide(UNION_CONTEXT_KEY, undefined);
  return unionCtx;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Format a label/title for rendering. Capitalizes the first letter and,
 * when in array context, appends a `#N` suffix as a separate piece so
 * callers can render it muted.
 */
export function formatIndexedLabel(
  label: string | undefined,
  arrayIndex: number | undefined,
): string | undefined {
  const base = label ? capitalize(label) : undefined;
  if (arrayIndex !== undefined) {
    return base ? `${base} #${arrayIndex + 1}` : `#${arrayIndex + 1}`;
  }
  return base;
}

/** Split a label into base + optional `#N` suffix for two-part rendering. */
export function formatIndexedLabelParts(
  label: string | undefined,
  arrayIndex: number | undefined,
): { base: string; suffix?: string } | undefined {
  const base = label ? capitalize(label) : "";
  if (arrayIndex === undefined) {
    return base ? { base } : undefined;
  }
  return { base, suffix: `#${arrayIndex + 1}` };
}
