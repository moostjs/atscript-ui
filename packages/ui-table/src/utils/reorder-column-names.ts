export type ColumnReorderPosition = "before" | "after";

/**
 * Permute a column-names array: move `fromPath` next to `toPath` at the
 * resolved insertion side. Pure: returns a new array, never mutates input.
 *
 * Returns the input array unchanged when:
 *   - `fromPath === toPath`
 *   - either path is missing from `names`
 *   - the resolved insertion index leaves the array identical
 *     (e.g. `[a,b,c]` from=`b` to=`a` "after" — `b` is already after `a`).
 *
 * The insertion index is resolved against post-removal positions to keep
 * the math symmetric across left-to-right and right-to-left moves.
 */
export function reorderColumnNames(
  names: string[],
  fromPath: string,
  toPath: string,
  position: ColumnReorderPosition,
): string[] {
  if (fromPath === toPath) return names;
  const fromIndex = names.indexOf(fromPath);
  if (fromIndex === -1) return names;
  const toIndex = names.indexOf(toPath);
  if (toIndex === -1) return names;

  // Indices in the array AFTER `fromPath` is removed.
  const without = names.slice(0, fromIndex).concat(names.slice(fromIndex + 1));
  const toIndexAfterRemoval = toIndex > fromIndex ? toIndex - 1 : toIndex;
  const insertAt = position === "before" ? toIndexAfterRemoval : toIndexAfterRemoval + 1;

  if (insertAt === fromIndex) return names;

  return without.slice(0, insertAt).concat(fromPath, without.slice(insertAt));
}
