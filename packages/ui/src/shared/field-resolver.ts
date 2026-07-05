import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import {
  UI_FORM_ATTR,
  UI_FORM_FN_ATTR,
  UI_FORM_FN_HIDDEN,
  UI_FORM_HIDDEN,
} from "./annotation-keys";

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
 * @atscript/ui provides a static implementation (reads only static annotation values).
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

/**
 * SSOT for field hidden resolution — resolves `@ui.form.fn.hidden`
 * (dynamic, via the active resolver) with static `@ui.form.hidden`
 * presence as the fallback. Absent both → `false` (visible).
 */
export function isFieldHidden(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
): boolean {
  return (
    resolveFieldProp<boolean>(prop, UI_FORM_FN_HIDDEN, UI_FORM_HIDDEN, scope, {
      staticAsBoolean: true,
    }) ?? false
  );
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

/** Checks whether a metadata key is present on an ATScript prop. */
export function hasFieldMeta(prop: TAtscriptAnnotatedType, key: string): boolean {
  return prop.metadata.has(key);
}

/** Ensures a value is an array — returns as-is if already one, wraps in `[x]` otherwise. */
export function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

// ── Specialized resolve helpers ──────────────────────────────

/**
 * Parses static `ui.attr` metadata into a key-value record.
 * Exported so ui-fns can reuse this without duplicating the parsing logic.
 */
export function parseStaticAttrs(staticAttrs: unknown): Record<string, unknown> | undefined {
  if (!staticAttrs) return undefined;
  const result: Record<string, unknown> = {};
  let hasAttrs = false;
  for (const item of asArray(staticAttrs)) {
    if (typeof item === "object" && item !== null && "name" in item && "value" in item) {
      const { name, value } = item as { name: string; value: string };
      result[name] = value;
      hasAttrs = true;
    }
  }
  return hasAttrs ? result : undefined;
}

/** Per-surface attr key pair — defaults to the form-side keys. */
export interface TResolveAttrsKeys {
  staticKey?: string;
  fnKey?: string;
}

/**
 * Resolves `<staticKey>` + `<fnKey>` attr metadata on demand.
 * Defaults read `ui.form.attr` + `ui.form.fn.attr`; pass `{ staticKey, fnKey }` to read
 * the table-side pair (`ui.table.attr` + `ui.table.fn.attr`) or any other surface.
 */
export function resolveAttrs(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
  keys: TResolveAttrsKeys = {},
): Record<string, unknown> | undefined {
  const staticKey = keys.staticKey ?? UI_FORM_ATTR;
  const fnKey = keys.fnKey ?? UI_FORM_FN_ATTR;

  const staticAttrs = getFieldMeta(prop, staticKey);
  const fnAttrs = getFieldMeta(prop, fnKey);

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
    const resolved = resolveFieldProp<Record<string, unknown>>(prop, fnKey, undefined, scope);
    if (resolved) {
      Object.assign(result, resolved);
      hasAttrs = true;
    }
  }

  return hasAttrs ? result : undefined;
}
