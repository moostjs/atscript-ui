import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

type ValidatorOpts = Parameters<TAtscriptAnnotatedType["validator"]>[0];
type ValidatorInstance = ReturnType<TAtscriptAnnotatedType["validator"]>;

const cache = new WeakMap<TAtscriptAnnotatedType, Map<string, ValidatorInstance>>();

/**
 * Memoize `type.validator(opts)` by `(type, opts)`. Outer WeakMap keyed by the
 * atscript type identity; inner Map keyed by the two opts we care about
 * (`partial`, `unknownProps`). Returns the same validator instance for the
 * same `(type, opts)` pair.
 */
export function getCachedValidator(
  type: TAtscriptAnnotatedType,
  opts?: ValidatorOpts,
): ValidatorInstance {
  const key = `${String(opts?.partial ?? "-")}|${String(opts?.unknownProps ?? "-")}`;
  let perType = cache.get(type);
  if (!perType) {
    perType = new Map();
    cache.set(type, perType);
  }
  let validator = perType.get(key);
  if (!validator) {
    validator = type.validator(opts);
    perType.set(key, validator);
  }
  return validator;
}
