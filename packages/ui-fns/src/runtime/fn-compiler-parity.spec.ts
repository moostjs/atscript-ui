import { deserializeFn } from "@prostojs/deserialize-fn";
import { describe, expect, it } from "vitest";
import { compileFieldFn, compileTopFn } from "./fn-compiler";
import type { TFnScope } from "./types";

// The compiler builds its sandbox by inheriting the hidden globals instead of
// copying them per call. Every observable of a compiled fn must match the
// `@prostojs/deserialize-fn` sandbox it replaced.

/** Outcome of a call: value, or the thrown error's constructor + message. */
function outcome(run: () => unknown): unknown {
  try {
    return { ok: run() };
  } catch (error) {
    return { threw: (error as Error).constructor.name, message: (error as Error).message };
  }
}

function reference(fnStr: string, scope: TFnScope) {
  return deserializeFn(`return (${fnStr})(v, data, context, entry)`)(scope);
}

/** Every enumerable name (own + inherited) of `this` — the sandbox when called bare inside `with`. */
function sandboxNames(this: object): string[] {
  const out: string[] = [];
  for (const k in this) out.push(k);
  return out.toSorted();
}

const scope = (): TFnScope => ({
  v: "abc",
  data: { name: "Ada", n: 2 },
  context: { role: "admin" },
  entry: undefined,
});

const CASES = [
  "(v, data, ctx) => data.name + ' ' + ctx.role + ' ' + v",
  // hidden globals resolve to null
  "() => [typeof window, typeof process, typeof globalThis, typeof console, typeof fetch, typeof eval, typeof __ctx__, typeof keys, typeof top]",
  "() => window === null && document === null && setTimeout === null",
  // non-hidden globals stay reachable
  "() => [typeof Math, typeof JSON, typeof Object, typeof Array.isArray, typeof Intl, typeof Date]",
  // Object.prototype members resolve through the sandbox object
  "() => [typeof toString, typeof hasOwnProperty, typeof valueOf, constructor === Object, typeof __proto__]",
  // assignments to sandbox names fail silently (frozen) — scope and hidden alike
  "() => { v = 'changed'; window = 1; data = null; return [v, window, data && data.name] }",
  // an undeclared name assignment leaks to the real global in sloppy mode — same either way
  "() => { __fnCompilerParityProbe = 1; const r = typeof __fnCompilerParityProbe; delete globalThis.__fnCompilerParityProbe; return r }",
  // `this` in a plain function call and in an arrow (sloppy mode → the global object)
  "() => (function () { return this === undefined ? 'undefined' : typeof this })()",
  "() => typeof this",
  // errors
  "() => notDefinedAnywhere",
  "() => { throw new TypeError('boom') }",
  "() => data.missing.deep",
  // params shadow the sandbox
  "(window, data) => [window, data.n]",
];

describe("fn-compiler sandbox parity with @prostojs/deserialize-fn", () => {
  for (const fnStr of CASES) {
    it(fnStr, () => {
      expect(outcome(() => compileFieldFn(fnStr)(scope()))).toEqual(
        outcome(() => reference(fnStr, scope())),
      );
    });
  }

  it("hides exactly the same global names", () => {
    // A bare call through `with` runs with the sandbox object as `this` —
    // read every name it resolves (own + inherited) from both sandboxes.
    const names = sandboxNames;
    const ours = compileTopFn<string[]>("() => probe()")({
      data: {},
      context: {},
      probe: names,
    } as unknown as TFnScope);
    const theirs = deserializeFn("return (() => probe())(data, context)")({
      data: {},
      context: {},
      probe: names,
    }) as string[];
    expect(ours).toEqual(theirs);
    expect(ours.length).toBeGreaterThan(80);
  });

  it("scope keys override hidden globals", () => {
    const s = { ...scope(), top: 5 } as unknown as TFnScope;
    expect(compileFieldFn("() => top")(s)).toBe(reference("() => top", s));
  });
});
