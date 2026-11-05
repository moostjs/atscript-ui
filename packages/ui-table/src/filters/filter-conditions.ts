import { getUiTexts, type UiT } from "@atscript/ui";
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

/** The UI text code of each condition's name. */
const CONDITION_LABELS: Record<FilterConditionType, string> = {
  eq: "UI_FILTER_COND_EQ",
  ne: "UI_FILTER_COND_NE",
  gt: "UI_FILTER_COND_GT",
  gte: "UI_FILTER_COND_GTE",
  lt: "UI_FILTER_COND_LT",
  lte: "UI_FILTER_COND_LTE",
  contains: "UI_FILTER_COND_CONTAINS",
  starts: "UI_FILTER_COND_STARTS",
  ends: "UI_FILTER_COND_ENDS",
  bw: "UI_FILTER_COND_BW",
  null: "UI_FILTER_COND_NULL",
  notNull: "UI_FILTER_COND_NOT_NULL",
  regex: "UI_FILTER_COND_REGEX",
};

/** Wording of the comparisons on a date / date-time column. */
const TEMPORAL_CONDITION_LABELS: Partial<Record<FilterConditionType, string>> = {
  eq: "UI_FILTER_DATE_EQ",
  ne: "UI_FILTER_DATE_NE",
  lt: "UI_FILTER_DATE_LT",
  lte: "UI_FILTER_DATE_LTE",
  gt: "UI_FILTER_DATE_GT",
  gte: "UI_FILTER_DATE_GTE",
  bw: "UI_FILTER_COND_BW",
};

/**
 * Human-readable label for a condition type. Pass the column's filter kind for
 * wording that fits it (`on` / `before` / `after` on `date` and `datetime`).
 * The words are UI texts read with `t` — the active UI locale's by default.
 */
export function conditionLabel(
  type: FilterConditionType,
  kind?: ColumnFilterType,
  t: UiT = getUiTexts().t,
): string {
  const code =
    ((kind === "date" || kind === "datetime") && TEMPORAL_CONDITION_LABELS[type]) ||
    CONDITION_LABELS[type];
  return code ? t(code) : type;
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

/**
 * Summarize a field's conditions into a human-readable token label. The
 * wording is UI texts read with `t` — the active UI locale's by default.
 */
export function filterTokenLabel(
  path: string,
  conditions: FilterCondition[],
  columnLabel?: string,
  t: UiT = getUiTexts().t,
): string {
  const filled = conditions.filter(isFilled);
  if (filled.length === 0) return "";
  const field = columnLabel ?? path;
  if (filled.length === 1) {
    const c = filled[0];
    if (c.type === "null") return t("UI_FILTER_CHIP_EMPTY", { field });
    if (c.type === "notNull") return t("UI_FILTER_CHIP_NOT_EMPTY", { field });
    if (c.type === "bw") {
      return t("UI_FILTER_CHIP_BETWEEN", { field, from: c.value[0], to: c.value[1] });
    }
    const condition = conditionLabel(c.type, undefined, t);
    return t("UI_FILTER_CHIP", { field, condition, value: c.value[0] });
  }
  return t("UI_FILTER_CHIP_COUNT", { field, count: filled.length });
}
