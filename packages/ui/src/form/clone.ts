// ── Structural deep clone (framework-agnostic) ───────────────

/**
 * Optional per-value unwrap hook. Lets a framework caller strip a reactive
 * proxy off every visited value before it is copied (e.g. Vue's `toRaw`). The
 * core never needs it — it is `undefined` here and the value passes through.
 */
export type CloneUnwrap = (value: unknown) => unknown;

/**
 * Structural deep clone of plain JSON-ish data (objects / arrays / primitives /
 * `Date`). Walks OWN-ENUMERABLE keys only (matches the own-key discipline in
 * `diff.ts` — never copies an accidental prototype) and copies leaves by value.
 *
 * `structuredClone` is deliberately NOT used: it throws on functions and on Vue
 * reactive proxies. The optional `unwrap` hook lets a framework caller
 * de-proxy each value first (vue-form passes `toRaw`); the core omits it.
 *
 * The SINGLE deep-clone primitive for the form engine — used by
 * `applyFormChanges`, `buildFormRebase`, and vue-form's baseline snapshot. Do
 * not reimplement structural cloning elsewhere.
 */
export function deepClone<T>(value: T, unwrap?: CloneUnwrap): T {
  const v = (unwrap ? unwrap(value) : value) as T;
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Date) return new Date(v.getTime()) as unknown as T;
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) out.push(deepClone(v[i], unwrap));
    return out as unknown as T;
  }
  const src = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    out[k] = deepClone(src[k], unwrap);
  }
  return out as T;
}
