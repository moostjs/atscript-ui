import type { FieldFilters, FilterCondition, FilterConditionType } from "./filter-types";

/** Check if a condition has a filled/meaningful value. */
export function isFilled(condition: FilterCondition): boolean {
  const { type, value } = condition;

  // null/notNull don't need values
  if (type === "null" || type === "notNull") return true;

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

/** Human-readable label for a condition type. */
export function conditionLabel(type: FilterConditionType): string {
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
