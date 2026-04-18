import type { FilterExpr } from "@uniqu/core";
import type { FieldFilters, FilterCondition, FilterConditionType } from "./filter-types";
import { isFilled } from "./filter-conditions";
import { escapeRegex } from "./escape-regex";

/** Exclusion condition types — AND'd together per field. */
const EXCLUSION_TYPES = new Set<FilterConditionType>(["ne", "notNull"]);

/**
 * Convert a single condition to a Uniquery filter expression.
 * Returns a ComparisonNode with the field as key.
 */
function conditionToExpr(field: string, condition: FilterCondition): FilterExpr {
  const v = condition.value;
  switch (condition.type) {
    case "eq":
      return { [field]: v[0] };
    case "ne":
      return { [field]: { $ne: v[0] } };
    case "gt":
      return { [field]: { $gt: v[0] } };
    case "gte":
      return { [field]: { $gte: v[0] } };
    case "lt":
      return { [field]: { $lt: v[0] } };
    case "lte":
      return { [field]: { $lte: v[0] } };
    case "contains":
      return { [field]: { $regex: `/${escapeRegex(String(v[0]))}/i` } };
    case "starts":
      return { [field]: { $regex: `/^${escapeRegex(String(v[0]))}/i` } };
    case "ends":
      return { [field]: { $regex: `/${escapeRegex(String(v[0]))}$/i` } };
    case "bw":
      return { [field]: { $gte: v[0], $lte: v[1] } };
    case "null":
      return { [field]: { $exists: false } };
    case "notNull":
      return { [field]: { $exists: true } };
    case "regex":
      return { [field]: { $regex: String(v[0]) } };
  }
}

/** Push a group of expressions: unwrap single, wrap multiple with the given operator. */
function pushGroup(target: FilterExpr[], items: FilterExpr[], op: "$or" | "$and"): void {
  if (items.length === 1) target.push(items[0]);
  else if (items.length > 1) target.push({ [op]: items } as FilterExpr);
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
export function filtersToUniqueryFilter(fieldFilters: FieldFilters): FilterExpr | undefined {
  const topGroups: FilterExpr[] = [];

  for (const field in fieldFilters) {
    const conditions = fieldFilters[field];
    let inclusions: FilterExpr[] | undefined;
    let exclusions: FilterExpr[] | undefined;

    for (const condition of conditions) {
      if (!isFilled(condition)) continue;
      const expr = conditionToExpr(field, condition);
      if (EXCLUSION_TYPES.has(condition.type)) {
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
