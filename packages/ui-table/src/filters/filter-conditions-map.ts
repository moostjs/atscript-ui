import type { FilterConditionType } from "./filter-types";

/** Column type categories for condition availability. */
export type ColumnFilterType = "text" | "number" | "date" | "boolean" | "enum" | "ref";

const TEXT_CONDITIONS: FilterConditionType[] = [
  "eq",
  "ne",
  "contains",
  "starts",
  "ends",
  "bw",
  "null",
  "notNull",
  "regex",
];

const NUMBER_CONDITIONS: FilterConditionType[] = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "bw",
  "null",
  "notNull",
];

const BOOLEAN_CONDITIONS: FilterConditionType[] = ["eq", "ne", "null", "notNull"];

const DATE_CONDITIONS: FilterConditionType[] = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "bw",
  "null",
  "notNull",
];

const CONDITIONS_MAP: Record<ColumnFilterType, FilterConditionType[]> = {
  text: TEXT_CONDITIONS,
  number: NUMBER_CONDITIONS,
  boolean: BOOLEAN_CONDITIONS,
  date: DATE_CONDITIONS,
  enum: TEXT_CONDITIONS,
  ref: TEXT_CONDITIONS,
};

/**
 * Available filter conditions for a given column filter type.
 *
 * `nullable` controls whether `null` / `notNull` survive — non-nullable
 * columns can never match those predicates, so the picker drops them.
 * Defaults to `true` to preserve historical behaviour for callers that
 * don't yet thread the column flag through.
 */
export function conditionsForType(
  type: ColumnFilterType,
  nullable = true,
): readonly FilterConditionType[] {
  const base = CONDITIONS_MAP[type] ?? CONDITIONS_MAP.text;
  if (nullable) return base;
  return base.filter((c) => c !== "null" && c !== "notNull");
}

/** Map a ColumnDef display type string to a ColumnFilterType. */
export function columnFilterType(columnType: string): ColumnFilterType {
  switch (columnType) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "enum":
      return "enum";
    case "ref":
      return "ref";
    default:
      return "text";
  }
}
