import type { FilterCondition, FilterConditionType } from "./filter-types";

/** Check if a condition has a filled/meaningful value. */
export function isFilled(condition: FilterCondition): boolean {
  const { type, value } = condition;

  // null/notNull don't need values
  if (type === "null" || type === "notNull") return true;

  // bw needs both values
  if (type === "bw") {
    return value.length >= 2 && value[0] != null && value[1] != null && value[0] !== "" && value[1] !== "";
  }

  // in/nin need at least one non-empty value
  if (type === "in" || type === "nin") {
    return value.length > 0 && value.some((v) => v != null && v !== "");
  }

  // all others need value[0]
  return value.length > 0 && value[0] != null && value[0] !== "";
}

/** Check if a condition type requires a second value (between). */
export function hasSecondValue(type: FilterConditionType): boolean {
  return type === "bw";
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
  in: "in set",
  nin: "not in set",
  null: "is empty",
  notNull: "is not empty",
  regex: "matches pattern",
};

/** Human-readable label for a condition type. */
export function conditionLabel(type: FilterConditionType): string {
  return CONDITION_LABELS[type] ?? type;
}
