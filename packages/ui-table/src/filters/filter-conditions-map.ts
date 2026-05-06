import { NULL_OPS } from "./filter-conditions";
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

const NON_NULLABLE_CONDITIONS_MAP = {
  text: TEXT_CONDITIONS.filter((c) => !NULL_OPS.has(c)),
  number: NUMBER_CONDITIONS.filter((c) => !NULL_OPS.has(c)),
  boolean: BOOLEAN_CONDITIONS.filter((c) => !NULL_OPS.has(c)),
  date: DATE_CONDITIONS.filter((c) => !NULL_OPS.has(c)),
  enum: TEXT_CONDITIONS.filter((c) => !NULL_OPS.has(c)),
  ref: TEXT_CONDITIONS.filter((c) => !NULL_OPS.has(c)),
} satisfies Record<ColumnFilterType, readonly FilterConditionType[]>;

/**
 * Available filter conditions for a given column filter type.
 * Non-nullable columns drop `null` / `notNull` since they can never match.
 */
export function conditionsForType(
  type: ColumnFilterType,
  nullable = true,
): readonly FilterConditionType[] {
  const map = nullable ? CONDITIONS_MAP : NON_NULLABLE_CONDITIONS_MAP;
  return map[type] ?? map.text;
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
