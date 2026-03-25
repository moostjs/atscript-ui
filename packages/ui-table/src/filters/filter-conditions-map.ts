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
  "in",
  "nin",
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
  "in",
  "nin",
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

const ENUM_CONDITIONS: FilterConditionType[] = ["in", "nin", "eq", "ne", "null", "notNull"];

const CONDITIONS_MAP: Record<ColumnFilterType, FilterConditionType[]> = {
  text: TEXT_CONDITIONS,
  number: NUMBER_CONDITIONS,
  boolean: BOOLEAN_CONDITIONS,
  date: DATE_CONDITIONS,
  enum: ENUM_CONDITIONS,
  ref: ENUM_CONDITIONS,
};

/** Available filter conditions for a given column filter type. */
export function conditionsForType(type: ColumnFilterType): readonly FilterConditionType[] {
  return CONDITIONS_MAP[type] ?? CONDITIONS_MAP.text;
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
