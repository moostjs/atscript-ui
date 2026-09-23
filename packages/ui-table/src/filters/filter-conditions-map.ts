import type { ColumnDef } from "@atscript/ui";
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

/** The `ColumnDef` fields that decide which filter conditions a column offers. */
export type FilterableColumn = Pick<ColumnDef, "type" | "nullable" | "filterable" | "filterOps">;

const EXISTENCE_CONDITIONS: readonly FilterConditionType[] = ["null", "notNull"];
const NO_CONDITIONS: readonly FilterConditionType[] = [];

/**
 * Filter conditions a column offers — the one answer every filter UI (column
 * menu, filter dialog, filter bar, config dialog) reads.
 *
 * - Value-filterable (`filterable: true`) → {@link conditionsForType} for its
 *   display type.
 * - Existence-only (`filterable: false`, `filterOps` includes `$exists` — a
 *   JSON-stored column) → `null` / `notNull`: whether a value is present,
 *   never what it is.
 * - Otherwise → `[]`: the column takes no filter.
 *
 * `null` / `notNull` are dropped for non-nullable columns, so an existence-only
 * column that is never empty offers nothing.
 *
 * @since 0.1.139
 */
export function columnFilterConditions(column: FilterableColumn): readonly FilterConditionType[] {
  if (column.filterable) return conditionsForType(columnFilterType(column.type), column.nullable);
  if (column.nullable && column.filterOps?.includes("$exists")) return EXISTENCE_CONDITIONS;
  return NO_CONDITIONS;
}

/**
 * Whether a column takes any filter at all — value comparisons or the
 * existence-only `null` / `notNull` pair. Use it (not
 * `column.filterable`, which is value comparison only) to decide whether to
 * show a column in a filter UI.
 *
 * @since 0.1.139
 */
export function isColumnFilterable(column: FilterableColumn): boolean {
  return columnFilterConditions(column).length > 0;
}
