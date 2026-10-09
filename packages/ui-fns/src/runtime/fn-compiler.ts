import { FNPool } from "@prostojs/deserialize-fn";
import type { TFnScope } from "./types";

type Compiled = (scope: TFnScope) => unknown;

const pool = new FNPool<unknown, TFnScope>();

// Fast lookup keyed by the annotation string itself, so a hot evaluation skips
// building the wrapper code string and hashing it in the pool. Separate maps:
// the same string compiles differently per kind.
const fieldFns = new Map<string, Compiled>();
const topFns = new Map<string, Compiled>();

/**
 * Compiles a field-level function string from a `@ui.form.fn.*` / `@ui.table.fn.*` annotation
 * into a callable function. Compiled once per string and cached (via FNPool).
 *
 * The function string should be an arrow or regular function expression:
 *   `"(v, data, ctx, entry) => !data.firstName"`
 *
 * The compiled function receives a single TFnScope object:
 *   `{ v, data, context, entry }`
 */
export function compileFieldFn<R = unknown>(fnStr: string): (scope: TFnScope) => R {
  let fn = fieldFns.get(fnStr);
  if (!fn) {
    fn = pool.getFn(`return (${fnStr})(v, data, context, entry)`);
    fieldFns.set(fnStr, fn);
  }
  return fn as (scope: TFnScope) => R;
}

/**
 * Compiles a form-level function string from a `@ui.form.fn.title` or similar annotation.
 *
 * The function string should be:
 *   `"(data, ctx) => someExpression"`
 *
 * The compiled function receives a single TFnScope object:
 *   `{ data, context }`
 */
export function compileTopFn<R = unknown>(fnStr: string): (scope: TFnScope) => R {
  let fn = topFns.get(fnStr);
  if (!fn) {
    fn = pool.getFn(`return (${fnStr})(data, context)`);
    topFns.set(fnStr, fn);
  }
  return fn as (scope: TFnScope) => R;
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
