import type { FormFieldChange } from "./diff";

/**
 * True when the field at dot-path `path` is dirty given a {@link FormFieldChange}
 * list (as produced by {@link buildFormDiff}).
 *
 * The change list is leaf-grained for scalars/objects but WHOLE-ARRAY for arrays,
 * so a field at `path` is dirty iff some change path equals `path` OR starts with
 * `path + "."`:
 *
 * - scalar / leaf field (incl. nested `address.city`) → exact match.
 * - object / section container → no entry at its own path, only its leaves →
 *   matched by the PREFIX branch.
 * - whole-array field → one entry at the array root → exact match.
 * - a field rendered for an array-ITEM leaf (e.g. `items.0.qty`) → NOT detectable:
 *   the array diff emits a single whole-array change at the array root, never
 *   per-item leaf paths, so this correctly returns false (the array container
 *   lights up instead). This is a known, documented limitation.
 *
 * The prefix uses `path + "."` so field `item` never matches a change at `items`
 * (no false positives).
 *
 * Empty `path` `''` is the wrapped form root — every change is nested under it,
 * so it is considered dirty iff there are ANY changes.
 */
export function isPathDirty(changes: FormFieldChange[], path: string): boolean {
  if (path === "") return changes.length > 0;
  const prefix = `${path}.`;
  for (const change of changes) {
    if (change.path === path || change.path.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Precomputes the set of ALL dirty paths from a {@link FormFieldChange} list so
 * that membership is an O(1) `Set.has(path)` instead of {@link isPathDirty}'s
 * per-call O(changes) prefix scan. Callers that probe many fields against the
 * same change list (e.g. a form rendering one field per leaf) build this once
 * and query it per field.
 *
 * For each change path `C` it adds `C` AND every dot-prefix ancestor of `C`
 * (so `'address.city'` adds both `'address.city'` and `'address'`), matching
 * `isPathDirty`'s "exact OR `path + '.'` prefix" predicate — an ancestor
 * container is dirty exactly when some change is nested under it. The wrapped
 * root `''` is added iff there are ANY changes, mirroring `isPathDirty('')`.
 *
 * INVARIANT (locked, tested): for EVERY path `P`,
 * `collectDirtyPaths(changes).has(P) === isPathDirty(changes, P)`. This is a
 * precompute of the SAME predicate, not a second one — keep them in lockstep.
 */
export function collectDirtyPaths(changes: FormFieldChange[]): Set<string> {
  const dirty = new Set<string>();
  if (changes.length === 0) return dirty;
  // Root: any change makes the wrapped root dirty (matches isPathDirty('')).
  dirty.add("");
  for (const change of changes) {
    const path = change.path;
    dirty.add(path);
    // Add every dot-prefix ancestor: 'a.b.c' → 'a.b', 'a'.
    let dot = path.indexOf(".");
    while (dot !== -1) {
      dirty.add(path.slice(0, dot));
      dot = path.indexOf(".", dot + 1);
    }
  }
  return dirty;
}
