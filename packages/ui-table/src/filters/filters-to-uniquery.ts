import type { FilterExpr } from "@uniqu/core";
import type { FieldFilters, FilterConditionType } from "./filter-types";
import { isFilled } from "./filter-conditions";
import { conditionToExpr } from "./condition-to-expr";
import type { ConditionEncoder } from "./value-encoder";

/** Exclusion condition types — AND'd together per field. */
const EXCLUSION_TYPES = new Set<FilterConditionType>(["ne", "notNull"]);

/** Whether conditions of `type` are exclusions (AND'd per field) rather than inclusions (OR'd). */
export function isExclusionType(type: FilterConditionType): boolean {
  return EXCLUSION_TYPES.has(type);
}

/** Push a group of expressions: unwrap single, wrap multiple with the given operator. */
function pushGroup(target: FilterExpr[], items: FilterExpr[], op: "$or" | "$and"): void {
  if (items.length === 1) target.push(items[0]);
  else if (items.length > 1) target.push({ [op]: items } as FilterExpr);
}

/** Options for {@link filtersToUniqueryFilter}. */
export interface FiltersToUniqueryOptions {
  /**
   * Column-aware value encoder (see `createColumnValueEncoder`), consulted for
   * each condition before the default conversion — an `undefined` result
   * falls through to it. Since 0.1.148.
   */
  encode?: ConditionEncoder;
}

/**
 * Convert UI filter model to a Uniquery FilterExpr.
 *
 * Combination logic:
 * - Per field: inclusion (positive) conditions are OR'd, exclusion (negative) conditions are AND'd.
 * - Across fields: all groups are AND'd at the top level.
 *
 * Returns `undefined` when no filled conditions exist.
 */
export function filtersToUniqueryFilter(
  fieldFilters: FieldFilters,
  opts?: FiltersToUniqueryOptions,
): FilterExpr | undefined {
  const encode = opts?.encode;
  // One clock reading for the whole query: every relative date means the same "today".
  const now = encode ? Date.now() : undefined;
  const topGroups: FilterExpr[] = [];

  for (const field in fieldFilters) {
    const conditions = fieldFilters[field];
    let inclusions: FilterExpr[] | undefined;
    let exclusions: FilterExpr[] | undefined;

    for (const condition of conditions) {
      if (!isFilled(condition)) continue;
      const expr = encode?.(field, condition, now) ?? conditionToExpr(field, condition);
      if (isExclusionType(condition.type)) {
        (exclusions ??= []).push(expr);
      } else {
        (inclusions ??= []).push(expr);
      }
    }

    if (inclusions) pushGroup(topGroups, inclusions, "$or");
    if (exclusions) pushGroup(topGroups, exclusions, "$and");
  }

  if (topGroups.length === 0) return undefined;
  if (topGroups.length === 1) return topGroups[0];
  return { $and: topGroups };
}
