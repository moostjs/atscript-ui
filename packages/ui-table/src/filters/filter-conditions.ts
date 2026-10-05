import type { ColumnFilterType } from "./filter-conditions-map";
import type { FieldFilters, FilterCondition, FilterConditionType } from "./filter-types";

/** Conditions that operate purely on nullability — value is ignored. */
export const NULL_OPS: ReadonlySet<FilterConditionType> = new Set(["null", "notNull"]);

/** Check if a condition has a filled/meaningful value. */
export function isFilled(condition: FilterCondition): boolean {
  const { type, value } = condition;

  // null/notNull don't need values
  if (NULL_OPS.has(type)) return true;

  // bw needs both values
  if (type === "bw") {
    return (
      value.length >= 2 &&
      value[0] != null &&
      value[1] != null &&
      value[0] !== "" &&
      value[1] !== ""
    );
  }

  // all others need value[0]
  return value.length > 0 && value[0] != null && value[0] !== "";
}

/** Check if a condition type requires a second value (between). */
export function hasSecondValue(type: FilterConditionType): boolean {
  return type === "bw";
}

export function isSimpleEq(condition: FilterCondition): boolean {
  return condition.type === "eq" && isFilled(condition);
}

const CONDITION_LABELS: Record<FilterConditionType, string> = {
  eq: "equals",
  ne: "not equals",
  gt: "greater than",
  gte: "greater or equal",
  lt: "less than",
  lte: "less or equal",
  contains: "contains",
  starts: "starts with",
  ends: "ends with",
  bw: "between",
  null: "is empty",
  notNull: "is not empty",
  regex: "matches pattern",
};

/** Wording of the comparisons on a date / date-time column. */
const TEMPORAL_CONDITION_LABELS: Partial<Record<FilterConditionType, string>> = {
  eq: "on",
  ne: "not on",
  lt: "before",
  lte: "on or before",
  gt: "after",
  gte: "on or after",
  bw: "between",
};

/**
 * Human-readable label for a condition type. Pass the column's filter kind for
 * wording that fits it (`on` / `before` / `after` on `date` and `datetime`).
 */
export function conditionLabel(type: FilterConditionType, kind?: ColumnFilterType): string {
  if (kind === "date" || kind === "datetime") {
    const temporal = TEMPORAL_CONDITION_LABELS[type];
    if (temporal) return temporal;
  }
  return CONDITION_LABELS[type] ?? type;
}

/** Count of fields that have at least one filled condition. */
export function filledFilterCount(filters: FieldFilters): number {
  let count = 0;
  for (const path in filters) {
    if (filters[path].some(isFilled)) count++;
  }
  return count;
}

/**
 * `filters` without the fields that have no filled condition — the shape
 * table state holds (a field with nothing filled has no entry). Returns
 * `filters` itself when every field has one; never mutates it.
 *
 * @since 0.1.142
 */
export function compactFieldFilters(filters: FieldFilters): FieldFilters {
  if (filledFilterCount(filters) === Object.keys(filters).length) return filters;
  const out: FieldFilters = {};
  for (const path in filters) {
    if (filters[path].some(isFilled)) out[path] = filters[path];
  }
  return out;
}

/** Summarize a field's conditions into a human-readable token label. */
export function filterTokenLabel(
  path: string,
  conditions: FilterCondition[],
  columnLabel?: string,
): string {
  const filled = conditions.filter(isFilled);
  if (filled.length === 0) return "";
  const label = columnLabel ?? path;
  if (filled.length === 1) {
    const c = filled[0];
    if (c.type === "null") return `${label}: empty`;
    if (c.type === "notNull") return `${label}: not empty`;
    if (c.type === "bw") return `${label}: ${c.value[0]} – ${c.value[1]}`;
    return `${label} ${conditionLabel(c.type)} ${c.value[0]}`;
  }
  return `${label}: ${filled.length} conditions`;
}
