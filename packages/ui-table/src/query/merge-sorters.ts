import type { SortControl } from "@atscript/ui-core";

/**
 * Merge force sorters with user sorters.
 *
 * Force sorters come first and take priority — if a field appears
 * in both lists, the force entry wins and the user entry is dropped.
 */
export function mergeSorters(
  forceSorters: SortControl[],
  userSorters: SortControl[],
): SortControl[] {
  if (forceSorters.length === 0) return userSorters;
  if (userSorters.length === 0) return forceSorters;

  const forceFields = new Set(forceSorters.map((s) => s.field));
  const deduped = userSorters.filter((s) => !forceFields.has(s.field));
  return [...forceSorters, ...deduped];
}
