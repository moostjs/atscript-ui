import type { TFnScope } from "./types";

/**
 * Names hidden from compiled functions — each resolves to `null` inside the
 * sandbox. Mirrors the `GLOBALS` list of `@prostojs/deserialize-fn` (parity
 * locked by a test).
 */
const HIDDEN_GLOBALS = [
  // Node.js
  "global",
  "process",
  "Buffer",
  "require",
  "__filename",
  "__dirname",
  "exports",
  "module",
  "setImmediate",
  "clearImmediate",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "queueGlobalMicrotask",
  "globalThis",
  // Browser
  "window",
  "self",
  "document",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches",
  "console",
  "performance",
  "fetch",
  "XMLHttpRequest",
  "Image",
  "Audio",
  "navigator",
  "navigation",
  "location",
  "history",
  "screen",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "cancelIdleCallback",
  "captureEvents",
  "chrome",
  "clientInformation",
  "addEventListener",
  "removeEventListener",
  "blur",
  "close",
  "closed",
  "confirm",
  "alert",
  "customElements",
  "dispatchEvent",
  "debug",
  "focus",
  "find",
  "frames",
  "getSelection",
  "getScreenDetails",
  "getEventListeners",
  "keys",
  "launchQueue",
  "parent",
  "postMessage",
  "print",
  "profile",
  "profileEnd",
  "prompt",
  "queryLocalFonts",
  "queryObjects",
  "releaseEvents",
  "reportError",
  "resizeBy",
  "resizeTo",
  "scheduler",
  "stop",
  "scroll",
  "scrollBy",
  "scrollTo",
  "scrollY",
  "scrollX",
  "top",
  // other
  "eval",
  "__ctx__",
] as const;

/**
 * The hidden globals as one frozen object every call's sandbox inherits
 * from. A call then copies only its own few scope keys instead of all ~80
 * hidden names, while name resolution inside `with` is unchanged: scope keys,
 * then the hidden globals (`null`), then `Object.prototype`, then the real
 * globals. Both levels are frozen, so assigning any sandbox name still fails
 * silently.
 */
const HIDDEN: Readonly<Record<string, null>> = Object.freeze(
  Object.fromEntries(HIDDEN_GLOBALS.map((name) => [name, null])),
);

type Compiled = (scope: TFnScope) => unknown;

/**
 * The per-call sandbox: the scope's own keys on an object inheriting
 * {@link HIDDEN}, frozen. A scope key that shadows a hidden (or inherited)
 * name is defined rather than assigned — assignment would hit the frozen
 * inherited property and throw.
 */
function sandbox(scope: TFnScope): object {
  const box = Object.create(HIDDEN) as Record<string, unknown>;
  const src = scope as unknown as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    if (key in box) {
      Object.defineProperty(box, key, {
        value: src[key],
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      box[key] = src[key];
    }
  }
  return Object.freeze(box);
}

function compileSandboxed(code: string): Compiled {
  const body = new Function("__ctx__", `with(__ctx__){\n${code}\n}`) as (ctx: object) => unknown;
  return (scope) => body(sandbox(scope));
}

// Compiled once per fn string. Keyed by the annotation string itself, so a
// hot evaluation skips building and hashing the wrapper code. Separate maps:
// the same string compiles differently per kind.
const fieldFns = new Map<string, Compiled>();
const topFns = new Map<string, Compiled>();

/**
 * Compiles a field-level function string from a `@ui.form.fn.*` / `@ui.table.fn.*` annotation
 * into a callable function. Compiled once per string and cached.
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
    fn = compileSandboxed(`return (${fnStr})(v, data, context, entry)`);
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
    fn = compileSandboxed(`return (${fnStr})(data, context)`);
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
