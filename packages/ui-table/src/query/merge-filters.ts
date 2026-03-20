import type { FilterExpr } from "@uniqu/core";

/**
 * AND-merge two filter expressions.
 *
 * Returns `{ $and: [a, b] }` when both are present,
 * the single one when only one exists, or `undefined` when neither.
 */
export function mergeFilters(
  a: FilterExpr | undefined,
  b: FilterExpr | undefined,
): FilterExpr | undefined {
  if (a && b) return { $and: [a, b] };
  return a ?? b;
}
