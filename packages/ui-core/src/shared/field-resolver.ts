import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import type { TFormEntryOptions } from "../form/types";
import { UI_ATTR, UI_FN_ATTR, UI_FN_OPTIONS, UI_OPTIONS } from "./annotation-keys";

// ── Resolve options ──────────────────────────────────────────

/** Options for field and form property resolution. */
export interface TResolveOptions<T> {
  /** When true, any non-undefined static value is returned as `true` (for boolean flags like ui.disabled). */
  staticAsBoolean?: boolean;
  /** Transform the raw static value before returning. */
  transform?: (raw: unknown) => T;
}

// ── FieldResolver interface ──────────────────────────────────

/**
 * Pluggable resolver interface for field/form metadata.
 * ui-core provides a static implementation (reads only static annotation values).
 * ui-fns extends it with dynamic `new Function` compilation for `ui.fn.*` keys.
 */
export interface FieldResolver {
  /** Resolve a field-level metadata property. */
  resolveFieldProp<T>(
    prop: TAtscriptAnnotatedType,
    fnKey: string,
    staticKey: string | undefined,
    scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined;

  /** Resolve a form-level metadata property. */
  resolveFormProp<T>(
    type: TAtscriptAnnotatedType,
    fnKey: string,
    staticKey: string | undefined,
    scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined;

  /** Check if a prop has dynamic annotations (ui.fn.*). */
  hasComputedAnnotations(prop: TAtscriptAnnotatedType): boolean;
}

// ── Static implementation ────────────────────────────────────

/** Static resolver — ignores fn keys, reads only static metadata. */
export class StaticFieldResolver implements FieldResolver {
  resolveFieldProp<T>(
    prop: TAtscriptAnnotatedType,
    _fnKey: string,
    staticKey: string | undefined,
    _scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined {
    return resolveStatic(prop.metadata, staticKey, opts);
  }

  resolveFormProp<T>(
    type: TAtscriptAnnotatedType,
    _fnKey: string,
    staticKey: string | undefined,
    _scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined {
    return resolveStatic(type.metadata, staticKey, opts);
  }

  hasComputedAnnotations(_prop: TAtscriptAnnotatedType): boolean {
    return false;
  }
}

/** Resolves a static metadata value. Exported for reuse by dynamic resolvers. */
export function resolveStatic<T>(
  metadata: TAtscriptAnnotatedType["metadata"],
  staticKey: string | undefined,
  opts?: TResolveOptions<T>,
): T | undefined {
  if (staticKey === undefined) return undefined;
  const staticVal = metadata.get(staticKey as keyof AtscriptMetadata);
  if (staticVal !== undefined) {
    if (opts?.staticAsBoolean) return true as T;
    if (opts?.transform) return opts.transform(staticVal);
    return staticVal as T;
  }
  return undefined;
}

// ── Resolver registry ────────────────────────────────────────

/** Default static resolver instance. */
export const defaultResolver = new StaticFieldResolver();

let activeResolver: FieldResolver = defaultResolver;

/** Replace the active resolver (called by ui-fns to install dynamic resolution). */
export function setResolver(resolver: FieldResolver): void {
  activeResolver = resolver;
}

/** Get the current active resolver. */
export function getResolver(): FieldResolver {
  return activeResolver;
}

// ── Standalone functions (delegate to active resolver) ───────

/** Resolve a field-level metadata property via the active resolver. */
export function resolveFieldProp<T>(
  prop: TAtscriptAnnotatedType,
  fnKey: string,
  staticKey: string | undefined,
  scope: Record<string, unknown>,
  opts?: TResolveOptions<T>,
): T | undefined {
  return activeResolver.resolveFieldProp(prop, fnKey, staticKey, scope, opts);
}

/** Resolve a form-level metadata property via the active resolver. */
export function resolveFormProp<T>(
  type: TAtscriptAnnotatedType,
  fnKey: string,
  staticKey: string | undefined,
  scope: Record<string, unknown>,
  opts?: TResolveOptions<T>,
): T | undefined {
  return activeResolver.resolveFormProp(type, fnKey, staticKey, scope, opts);
}

/** Check if a prop has dynamic annotations via the active resolver. */
export function hasComputedAnnotations(prop: TAtscriptAnnotatedType): boolean {
  return activeResolver.hasComputedAnnotations(prop);
}

// ── Direct metadata helpers (no resolver needed) ─────────────

/**
 * Reads a static metadata value from an ATScript prop.
 * Typed overload for known AtscriptMetadata keys; falls back to `unknown` for other keys.
 */
export function getFieldMeta<K extends keyof AtscriptMetadata>(
  prop: TAtscriptAnnotatedType,
  key: K,
): AtscriptMetadata[K] | undefined;
export function getFieldMeta(prop: TAtscriptAnnotatedType, key: string): unknown;
export function getFieldMeta(prop: TAtscriptAnnotatedType, key: string): unknown {
  return prop.metadata.get(key as keyof AtscriptMetadata);
}

/** Ensures a value is an array — returns as-is if already one, wraps in `[x]` otherwise. */
export function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

/** Extracts the key from an option entry. */
export function optKey(opt: TFormEntryOptions): string {
  return typeof opt === "string" ? opt : opt.key;
}

/** Extracts the display label from an option entry. */
export function optLabel(opt: TFormEntryOptions): string {
  return typeof opt === "string" ? opt : opt.label;
}

/**
 * Converts raw option annotation value to a normalized array.
 */
export function parseStaticOptions(raw: unknown): TFormEntryOptions[] {
  const items = asArray(raw);
  return items.map((item) => {
    if (typeof item === "object" && item !== null && "label" in item) {
      const { label, value } = item as { label: string; value?: string };
      return value !== undefined ? { key: value, label } : label;
    }
    return String(item);
  });
}

// ── Specialized resolve helpers ──────────────────────────────

/**
 * Resolves options from `ui.fn.options` / `ui.options` metadata on demand.
 * The fn key is only resolved when ui-fns is installed.
 */
export function resolveOptions(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
): TFormEntryOptions[] | undefined {
  return resolveFieldProp<TFormEntryOptions[]>(prop, UI_FN_OPTIONS, UI_OPTIONS, scope, {
    transform: parseStaticOptions,
  });
}

/**
 * Parses static `ui.attr` metadata into a key-value record.
 * Exported so ui-fns can reuse this without duplicating the parsing logic.
 */
export function parseStaticAttrs(staticAttrs: unknown): Record<string, unknown> | undefined {
  if (!staticAttrs) return undefined;
  const result: Record<string, unknown> = {};
  let hasAttrs = false;
  for (const item of asArray(staticAttrs)) {
    if (typeof item === "object" && item !== null && "key" in item && "value" in item) {
      const { key, value } = item as { key: string; value: string };
      result[key] = value;
      hasAttrs = true;
    }
  }
  return hasAttrs ? result : undefined;
}

/**
 * Resolves `ui.attr` + `ui.fn.attr` from metadata on demand.
 * Static attrs come from `ui.attr`. Dynamic fn attrs delegate through the active resolver.
 */
export function resolveAttrs(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const staticAttrs = getFieldMeta(prop, UI_ATTR);
  const fnAttrs = getFieldMeta(prop, UI_FN_ATTR);

  if (!staticAttrs && !fnAttrs) return undefined;

  const result: Record<string, unknown> = {};
  let hasAttrs = false;

  const parsed = parseStaticAttrs(staticAttrs);
  if (parsed) {
    Object.assign(result, parsed);
    hasAttrs = true;
  }

  // Delegate fn attrs through the active resolver (static resolver returns undefined; dynamic compiles)
  if (fnAttrs) {
    const resolved = resolveFieldProp<Record<string, unknown>>(prop, UI_FN_ATTR, undefined, scope);
    if (resolved) {
      Object.assign(result, resolved);
      hasAttrs = true;
    }
  }

  return hasAttrs ? result : undefined;
}
