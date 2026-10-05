import { NUMERIC_VALUE_KINDS, type ColumnDef } from "@atscript/ui";
import { NULL_OPS } from "./filter-conditions";
import type { FilterConditionType } from "./filter-types";

/**
 * Column type categories for condition availability. `datetime` (since
 * 0.1.148) is a date filter on a column that stores instants — a timestamp or
 * an ISO date-time; it offers the same conditions as `date`.
 */
export type ColumnFilterType = "text" | "number" | "date" | "datetime" | "boolean" | "enum" | "ref";

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

/** The one source of what each kind offers; the tables below are derived from it. */
const CONDITIONS_MAP: Record<ColumnFilterType, FilterConditionType[]> = {
  text: TEXT_CONDITIONS,
  number: NUMBER_CONDITIONS,
  boolean: BOOLEAN_CONDITIONS,
  date: DATE_CONDITIONS,
  datetime: DATE_CONDITIONS,
  enum: TEXT_CONDITIONS,
  ref: TEXT_CONDITIONS,
};

const PATTERN_CONDITIONS: ReadonlySet<FilterConditionType> = new Set([
  "contains",
  "starts",
  "ends",
  "regex",
]);

/** `CONDITIONS_MAP` without the `null` / `notNull` and/or the pattern conditions. */
function deriveMap(
  dropNull: boolean,
  dropPatterns: boolean,
): Record<ColumnFilterType, readonly FilterConditionType[]> {
  const out = {} as Record<ColumnFilterType, readonly FilterConditionType[]>;
  for (const kind of Object.keys(CONDITIONS_MAP) as ColumnFilterType[]) {
    out[kind] = CONDITIONS_MAP[kind].filter(
      (c) => !(dropNull && NULL_OPS.has(c)) && !(dropPatterns && PATTERN_CONDITIONS.has(c)),
    );
  }
  return out;
}

const DERIVED = {
  full: CONDITIONS_MAP,
  nonNullable: deriveMap(true, false),
  noPatterns: deriveMap(false, true),
  nonNullableNoPatterns: deriveMap(true, true),
} as const;

/**
 * Available filter conditions for a given column filter type.
 *
 * - A non-nullable column drops `null` / `notNull` (they can never match).
 * - A column whose storage (`valueKind`) is not `string` drops the pattern
 *   conditions (`contains` / `starts` / `ends` / `regex`): pattern matching is
 *   `$regex`, which the server only takes on a string field — a numeric `ref` /
 *   `enum` cannot.
 */
export function conditionsForType(
  type: ColumnFilterType,
  nullable = true,
  valueKind?: ColumnDef["valueKind"],
): readonly FilterConditionType[] {
  const noPatterns = valueKind !== undefined && valueKind !== "string";
  const map = nullable
    ? noPatterns
      ? DERIVED.noPatterns
      : DERIVED.full
    : noPatterns
      ? DERIVED.nonNullableNoPatterns
      : DERIVED.nonNullable;
  return map[type] ?? map.text;
}

/** Map a ColumnDef display type string to a ColumnFilterType. */
export function columnFilterType(columnType: string): ColumnFilterType {
  switch (columnType) {
    case "number":
    case "boolean":
    case "date":
    case "datetime":
    case "enum":
    case "ref":
      return columnType;
    default:
      return "text";
  }
}

/** Whether a filter kind is a date filter (`date` or `datetime`). */
export function isTemporalKind(kind: ColumnFilterType): kind is "date" | "datetime" {
  return kind === "date" || kind === "datetime";
}

/** The `ColumnDef` fields that decide which filter conditions a column offers. */
export type FilterableColumn = Pick<
  ColumnDef,
  "type" | "nullable" | "filterable" | "filterOps" | "valueKind"
>;

/**
 * The filter kind of a column from its display type and storage kind. See
 * `columnFilterKind` for the rules.
 */
export function resolveFilterKind(
  column: Pick<FilterableColumn, "type" | "valueKind">,
): ColumnFilterType {
  const display = columnFilterType(column.type);
  const valueKind = column.valueKind;
  switch (valueKind) {
    case "timestamp":
      if (display === "number") return "number";
      return display === "date" ? "date" : "datetime";
    case "isoDate":
      return display === "date" ? "date" : "datetime";
    case "date":
      return "date";
    case "boolean":
      return display === "text" ? "boolean" : display;
    default:
      return display === "text" && valueKind && NUMERIC_VALUE_KINDS.has(valueKind)
        ? "number"
        : display;
  }
}
