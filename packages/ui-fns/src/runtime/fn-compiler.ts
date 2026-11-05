import { FNPool } from "@prostojs/deserialize-fn";
import { getUiTexts, type UiT } from "@atscript/ui";
import type { TFnScope, TTableFnScope } from "./types";

// One pool for every kind: it is keyed by the wrapped code, which differs per kind.
const pool = new FNPool<unknown, object>();

/** The scope's `t` (see {@link TFnScope.t}), else the active UI texts'. */
export function scopeT(scope: { t?: UiT }): UiT {
  return scope.t ?? getUiTexts().t;
}

/**
 * A compiler calling the function string with `args`, `t` filled by
 * {@link scopeT}. Cached per annotation string, so a hot evaluation skips
 * building the wrapper code string and hashing it in the pool; one cache per
 * kind, since the same string compiles differently per kind.
 */
function fnCompiler<S extends { t?: UiT }>(args: string): (fnStr: string) => (scope: S) => unknown {
  const cache = new Map<string, (scope: S) => unknown>();
  return (fnStr) => {
    let fn = cache.get(fnStr);
    if (!fn) {
      const run = pool.getFn(`return (${fnStr})(${args})`);
      fn = (scope) => run(scope.t ? scope : { ...scope, t: scopeT(scope) });
      cache.set(fnStr, fn);
    }
    return fn;
  };
}

const fieldFn = fnCompiler<TFnScope>("v, data, context, entry, t");
const topFn = fnCompiler<TFnScope>("data, context, t");
const tableFn = fnCompiler<TTableFnScope>("row, ctx, t");

/**
 * Compiles a field-level function string from a `@ui.form.fn.*` annotation
 * into a callable function. Compiled once per string and cached (via FNPool).
 *
 * The function string should be an arrow or regular function expression:
 *   `"(v, data, ctx, entry) => !data.firstName"`
 *
 * The compiled function receives a single TFnScope object:
 *   `{ v, data, context, entry, t }` — `t` is the trailing argument (see {@link TFnScope.t}).
 */
export function compileFieldFn<R = unknown>(fnStr: string): (scope: TFnScope) => R {
  return fieldFn(fnStr) as (scope: TFnScope) => R;
}

/**
 * Compiles a form-level function string from a `@ui.form.fn.title` or similar annotation.
 *
 * The function string should be:
 *   `"(data, ctx) => someExpression"`
 *
 * The compiled function receives a single TFnScope object:
 *   `{ data, context, t }` — `t` is the trailing argument.
 */
export function compileTopFn<R = unknown>(fnStr: string): (scope: TFnScope) => R {
  return topFn(fnStr) as (scope: TFnScope) => R;
}

/**
 * Compiles a per-cell function string from a `@ui.table.fn.*` annotation:
 *   `"(row, ctx) => row.status === 'paid' ? 'text-success' : ''"`
 *
 * The compiled function receives a {@link TTableFnScope} `{ row, ctx, t }` and
 * calls the function as `(row, ctx, t)`.
 */
export function compileTableFn<R = unknown>(fnStr: string): (scope: TTableFnScope) => R {
  return tableFn(fnStr) as (scope: TTableFnScope) => R;
}

/**
 * Compiles a validator function string.
 * Delegates to `compileFieldFn` with a narrowed return type.
 *
 * Returns `true` for valid, or a string error message for invalid.
 */
export function compileValidatorFn(fnStr: string) {
  return compileFieldFn<boolean | string>(fnStr);
}
