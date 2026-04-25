import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import type { FieldResolver, TResolveOptions } from "@atscript/ui";
import {
  META_READONLY,
  UI_COMPONENT,
  UI_DISABLED,
  UI_FN_ATTR,
  UI_FN_DISABLED,
  UI_FN_HIDDEN,
  UI_FN_PREFIX,
  UI_FN_READONLY,
  UI_HIDDEN,
  UI_TYPE,
  asArray,
  getFieldMeta,
  resolveFieldProp,
  resolveOptions,
  resolveStatic,
} from "@atscript/ui";
import { compileFieldFn, compileTopFn } from "./fn-compiler";
import type { TFieldEvaluated, TFnScope } from "./types";

/** Options for buildFieldEntry — allows pre-resolved overrides. */
export type TBuildFieldEntryOpts = Partial<
  Pick<
    TFieldEvaluated,
    "name" | "type" | "component" | "optional" | "disabled" | "hidden" | "readonly"
  >
>;

/**
 * Dynamic field resolver — extends static resolution with `new Function` compilation
 * for `ui.fn.*` annotation keys.
 *
 * Install via `installDynamicResolver()` from the package index.
 */
export class DynamicFieldResolver implements FieldResolver {
  resolveFieldProp<T>(
    prop: TAtscriptAnnotatedType,
    fnKey: string,
    staticKey: string | undefined,
    scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined {
    // Special case: ui.fn.attr stores array of {name, fn} objects, not a single fn string
    if (fnKey === UI_FN_ATTR) {
      return this.resolveAttrFns(prop, scope as unknown as TFnScope) as T | undefined;
    }
    return resolveAnnotatedProp(
      prop.metadata,
      fnKey,
      staticKey,
      scope as unknown as TFnScope,
      compileFieldFn as CompileFn<T>,
      opts,
    );
  }

  resolveFormProp<T>(
    type: TAtscriptAnnotatedType,
    fnKey: string,
    staticKey: string | undefined,
    scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined {
    return resolveAnnotatedProp(
      type.metadata,
      fnKey,
      staticKey,
      scope as unknown as TFnScope,
      compileTopFn as CompileFn<T>,
      opts,
    );
  }

  hasComputedAnnotations(prop: TAtscriptAnnotatedType): boolean {
    for (const key of prop.metadata.keys()) {
      if ((key as string).startsWith(UI_FN_PREFIX)) return true;
    }
    return false;
  }

  private resolveAttrFns(
    prop: TAtscriptAnnotatedType,
    scope: TFnScope,
  ): Record<string, unknown> | undefined {
    const fnAttrs = prop.metadata.get(UI_FN_ATTR as keyof AtscriptMetadata) as unknown;
    if (!fnAttrs) return undefined;

    const result: Record<string, unknown> = {};
    let hasAttrs = false;

    for (const item of asArray(fnAttrs)) {
      if (typeof item === "object" && item !== null && "name" in item && "fn" in item) {
        const { name, fn } = item as { name: string; fn: string };
        result[name] = compileFieldFn(fn)(scope);
        hasAttrs = true;
      }
    }

    return hasAttrs ? result : undefined;
  }
}

// ── Internal resolve logic ───────────────────────────────────

type CompileFn<T> = (fnStr: string) => (scope: TFnScope) => T;

function resolveAnnotatedProp<T>(
  metadata: TAtscriptAnnotatedType["metadata"],
  fnKey: string,
  staticKey: string | undefined,
  scope: TFnScope,
  compileFn: CompileFn<T>,
  opts?: TResolveOptions<T>,
): T | undefined {
  const fnStr = metadata.get(fnKey as keyof AtscriptMetadata);
  if (typeof fnStr === "string") {
    return compileFn(fnStr)(scope);
  }

  // Reuse @atscript/ui's static resolution for the fallback path
  return resolveStatic(metadata, staticKey, opts);
}

// ── buildFieldEntry (dual-scope pattern) ─────────────────────

/**
 * Builds a `TFieldEvaluated` entry and returns a full scope containing it.
 *
 * Implements the dual-scope pattern:
 * 1. Resolve constraints (disabled/hidden/readonly) from `baseScope`
 * 2. Assemble the entry object
 * 3. Build full scope (`{ ...baseScope, entry }`)
 * 4. Resolve options into the entry using the full scope
 */
export function buildFieldEntry(
  prop: TAtscriptAnnotatedType,
  baseScope: TFnScope,
  path: string,
  opts?: TBuildFieldEntryOpts,
): TFnScope {
  const boolOpts = { staticAsBoolean: true } as const;
  const scopeAsRecord = baseScope as unknown as Record<string, unknown>;

  const entry: TFieldEvaluated = {
    field: path,
    type: opts?.type ?? (getFieldMeta(prop, UI_TYPE) as string | undefined) ?? "text",
    component: opts?.component ?? (getFieldMeta(prop, UI_COMPONENT) as string | undefined),
    name: opts?.name ?? path.slice(path.lastIndexOf(".") + 1),
    optional: opts?.optional ?? prop.optional,
    disabled:
      opts?.disabled ??
      resolveFieldProp<boolean>(prop, UI_FN_DISABLED, UI_DISABLED, scopeAsRecord, boolOpts),
    hidden:
      opts?.hidden ??
      resolveFieldProp<boolean>(prop, UI_FN_HIDDEN, UI_HIDDEN, scopeAsRecord, boolOpts),
    readonly:
      opts?.readonly ??
      resolveFieldProp<boolean>(prop, UI_FN_READONLY, META_READONLY, scopeAsRecord, boolOpts),
  };

  const scope: TFnScope = { ...baseScope, entry };
  entry.options = resolveOptions(prop, scope as unknown as Record<string, unknown>);
  return scope;
}
