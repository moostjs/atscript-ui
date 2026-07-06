/**
 * Framework-agnostic helpers for working with form-error maps keyed by
 * dotted path. Used by AsForm to drive error badges and auto-open
 * collapsed sections; safe to share with React (or any other) bindings.
 *
 * Convention:
 *   - Keys are dotted paths (`a.b.c`); empty string and `__form` denote
 *     the form-level error.
 *   - Values may be `string | undefined`; falsy entries are dropped on
 *     merge.
 */

const FORM_ERROR_KEY = "__form";

/**
 * Merge any number of partial error maps into a single dense
 * `Record<path, message>`. Falsy values are skipped — later sources do
 * NOT overwrite earlier ones with an empty value.
 */
export function mergeErrorMaps(
  ...maps: Array<Record<string, string | undefined> | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const k of Object.keys(m)) {
      const v = m[k];
      if (v) merged[k] = v;
    }
  }
  return merged;
}

/**
 * Return `errors` without the entries whose key is in `paths`.
 *
 * Identity-preserving: when no key matches, the ORIGINAL `errors` object
 * is returned unchanged — callers compare `result !== errors` to detect
 * that something was pruned and skip spurious reactive writes.
 */
export function omitPaths(
  errors: Record<string, string>,
  paths: ReadonlySet<string>,
): Record<string, string> {
  let pruned: Record<string, string> | null = null;
  for (const key in errors) {
    if (paths.has(key)) {
      pruned ??= { ...errors };
      delete pruned[key];
    }
  }
  return pruned ?? errors;
}

/**
 * Yield every ancestor prefix of a dotted path, longest-first
 * (`a.b.c` → `a.b.c`, `a.b`, `a`). Returns the path itself first so
 * callers can include it in the iteration without a special case.
 *
 * Empty paths and the form-level key (`__form`) yield nothing.
 */
export function* iteratePathAncestors(path: string): Generator<string> {
  if (!path || path === FORM_ERROR_KEY) return;
  let pos = path.length;
  while (pos > 0) {
    yield path.slice(0, pos);
    const dot = path.lastIndexOf(".", pos - 1);
    if (dot < 0) return;
    pos = dot;
  }
}

/**
 * Build an indexed `Map<absolutePath, descendantErrorCount>` so each
 * struct in the tree can render an error-count badge in O(1).
 *
 * For every error path, the count is incremented on the path itself
 * AND every dotted-path ancestor — so a struct at `a.b` reports the
 * total of all errors at `a.b` or below.
 */
export function buildDescendantErrorCounts(
  errors: Record<string, string | undefined>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const errPath of Object.keys(errors)) {
    if (!errors[errPath]) continue;
    for (const prefix of iteratePathAncestors(errPath)) {
      map.set(prefix, (map.get(prefix) ?? 0) + 1);
    }
  }
  return map;
}
