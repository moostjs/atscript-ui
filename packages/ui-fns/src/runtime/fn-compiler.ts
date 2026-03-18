import { FNPool } from "@prostojs/deserialize-fn";
import type { TFnScope } from "./types";

const pool = new FNPool();

/**
 * Compiles a field-level function string from a `@ui.fn.*` annotation
 * into a callable function. Uses FNPool for caching.
 *
 * The function string should be an arrow or regular function expression:
 *   `"(v, data, ctx, entry) => !data.firstName"`
 *
 * The compiled function receives a single TFnScope object:
 *   `{ v, data, context, entry }`
 */
export function compileFieldFn<R = unknown>(fnStr: string): (scope: TFnScope) => R {
  const code = `return (${fnStr})(v, data, context, entry)`;
  return pool.getFn(code) as (scope: TFnScope) => R;
}

/**
 * Compiles a form-level function string from a `@ui.fn.title` or similar annotation.
 *
 * The function string should be:
 *   `"(data, ctx) => someExpression"`
 *
 * The compiled function receives a single TFnScope object:
 *   `{ data, context }`
 */
export function compileTopFn<R = unknown>(fnStr: string): (scope: TFnScope) => R {
  const code = `return (${fnStr})(data, context)`;
  return pool.getFn(code) as (scope: TFnScope) => R;
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
