import type { ColumnDef } from "@atscript/ui";
import {
  conditionsForType,
  isTemporalKind,
  resolveFilterKind,
  type ColumnFilterType,
  type FilterableColumn,
} from "./filter-conditions-map";
import type { FilterConditionType } from "./filter-types";
import { parseTemporal } from "./temporal";
import { coerceBoolean, coerceNumericText } from "./value-coerce";

/**
 * How a column's filter values are typed before they reach the server. The
 * temporal encodings turn a calendar period into epoch ms (`epoch`), an ISO
 * instant string (`iso`) or a `YYYY-MM-DD` string (`date`); `dateText` is
 * `date` for a plain string column of unknown format, which a time of day is
 * never cut for. The others type one scalar.
 */
export type ValueEncoding =
  | "epoch"
  | "iso"
  | "date"
  | "dateText"
  | "boolean"
  | "number"
  | "integer"
  | "decimal";

/** Everything a filter UI or the query builder needs to know about one column. */
export interface ColumnFilter {
  /** The filter kind — what the filter input looks like. */
  kind: ColumnFilterType;
  /** The conditions the column offers (empty: it takes no filter). */
  conditions: readonly FilterConditionType[];
  /** The condition a fresh filter starts with. */
  defaultCondition: FilterConditionType;
  /** How the column's values are typed at query time; `undefined`: as they are. */
  encoding: ValueEncoding | undefined;
  /**
   * The typed model value of typed-in text, or `undefined` when it is not a
   * value for this column (nothing should be sent). An empty string stays `""`
   * for a number (an unfilled box).
   */
  coerce: (raw: string) => string | number | boolean | undefined;
}

const EXISTENCE_CONDITIONS: readonly FilterConditionType[] = ["null", "notNull"];
const NO_CONDITIONS: readonly FilterConditionType[] = [];

/** Default condition when no operator symbol is typed. @internal */
export function defaultConditionOf(kind: ColumnFilterType): FilterConditionType {
  return kind === "text" || kind === "enum" || kind === "ref" ? "contains" : "eq";
}

/** A bare run of digits this long is an epoch-millisecond value, not a year. */
const EPOCH_DIGITS = /^-?\d{10,}$/;

/** The Uniquery operators each condition is sent as — what the server must accept. */
const OPS: Record<FilterConditionType, readonly string[]> = {
  eq: ["$eq"],
  ne: ["$ne"],
  gt: ["$gt"],
  gte: ["$gte"],
  lt: ["$lt"],
  lte: ["$lte"],
  bw: ["$gte", "$lte"],
  contains: ["$regex"],
  starts: ["$regex"],
  ends: ["$regex"],
  regex: ["$regex"],
  null: ["$exists"],
  notNull: ["$exists"],
};

/** The same for a date filter, which compares against period bounds (`[start, end)`). */
const TEMPORAL_OPS: Partial<Record<FilterConditionType, readonly string[]>> = {
  eq: ["$gte", "$lt"],
  ne: ["$gte", "$lt"],
  gt: ["$gte"],
  gte: ["$gte"],
  lt: ["$lt"],
  lte: ["$lt"],
  bw: ["$gte", "$lt"],
};

function encodingOf(
  kind: ColumnFilterType,
  valueKind: ColumnDef["valueKind"],
): ValueEncoding | undefined {
  if (isTemporalKind(kind)) {
    switch (valueKind) {
      case "timestamp":
      case "number":
      case "integer":
        return "epoch";
      case "isoDate":
        return "iso";
      case "date":
        return "date";
      case "string":
        return "dateText";
      default:
        return undefined;
    }
  }
  switch (valueKind) {
    case "boolean":
      return "boolean";
    case "number":
    case "decimal":
      return valueKind;
    case "integer":
    case "timestamp":
      return "integer";
    default:
      return undefined;
  }
}

function conditionsOf(column: FilterColumnInput, kind: ColumnFilterType) {
  if (column.filterable) {
    const offered = conditionsForType(kind, column.nullable, column.valueKind);
    const reported = column.filterOps;
    // The server's own list of accepted operators wins when it reports one;
    // the storage-kind rules above are the fallback.
    if (!reported) return offered;
    const ops = isTemporalKind(kind) ? TEMPORAL_OPS : {};
    return offered.filter((c) => (ops[c] ?? OPS[c]).every((op) => reported.includes(op)));
  }
  // Existence-only (a JSON-stored column): whether a value is present, never what it is.
  if (column.nullable && column.filterOps?.includes("$exists")) return EXISTENCE_CONDITIONS;
  return NO_CONDITIONS;
}

/** The input coercer for a filter kind over a storage kind. @internal */
export function coercerOf(
  kind: ColumnFilterType,
  valueKind: ColumnDef["valueKind"],
): ColumnFilter["coerce"] {
  switch (kind) {
    case "number":
      return (raw) => (raw === "" ? "" : coerceNumericText(raw, valueKind));
    case "boolean":
      return coerceBoolean;
    case "date":
    case "datetime":
      // A temporal value must be one the grammar knows; a long digit run is epoch ms.
      return (raw) => (EPOCH_DIGITS.test(raw) ? Number(raw) : parseTemporal(raw) ? raw : undefined);
    default:
      return (raw) => raw;
  }
}

/** The `ColumnDef` fields the resolver reads; only `type` and `valueKind` are needed for the kind and encoding. */
export type FilterColumnInput = Pick<FilterableColumn, "type" | "valueKind"> &
  Partial<FilterableColumn>;

const cache = new WeakMap<object, ColumnFilter>();

/**
 * The filter capabilities of a column, derived once per `ColumnDef` object:
 * its kind, offered conditions, default condition, input coercion and value
 * encoding. Every filter UI and the query builder read this instead of
 * re-deriving them from `type` / `valueKind` / `filterOps`.
 *
 * The kind follows the display type, but the storage kind (`valueKind`)
 * decides what the server accepts: `timestamp` → `datetime` (`date` when
 * displayed as a date, `number` when displayed as a plain number — an opt-out
 * to raw ms), `isoDate` → `datetime`, `date` → `date`; a text kind over a
 * numeric or boolean `valueKind` becomes `number` / `boolean`. `enum` and
 * `ref` keep their kind — they have a dropdown.
 *
 * The column is treated as immutable.
 *
 * @internal Use `columnFilterKind` / `columnFilterConditions` / `columnDefaultCondition`.
 */
export function columnFilter(column: FilterColumnInput): ColumnFilter {
  let spec = cache.get(column);
  if (!spec) {
    const kind = resolveFilterKind(column);
    const conditions = conditionsOf(column, kind);
    const base = defaultConditionOf(kind);
    spec = {
      kind,
      conditions,
      // The type's own default when the column offers it, else the first it does offer.
      defaultCondition: conditions.length === 0 || conditions.includes(base) ? base : conditions[0],
      encoding: encodingOf(kind, column.valueKind),
      coerce: coercerOf(kind, column.valueKind),
    };
    cache.set(column, spec);
  }
  return spec;
}

/**
 * The filter kind of a column — what its filter input and conditions follow.
 * Every filter UI reads this rather than {@link columnFilterType}(`column.type`),
 * because the storage kind (`valueKind`) decides what the server accepts.
 *
 * @since 0.1.148
 */
export function columnFilterKind(column: FilterColumnInput): ColumnFilterType {
  return columnFilter(column).kind;
}

/**
 * Filter conditions a column offers — the one answer every filter UI (column
 * menu, filter dialog, filter bar, config dialog) reads.
 *
 * - Value-filterable (`filterable: true`) → the conditions of its kind, minus
 *   what its storage or the server's reported `filterOps` cannot take.
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
  return columnFilter(column).conditions;
}

/**
 * The condition a column's filter input starts with: its type's default when
 * the column offers it, otherwise the first condition it does offer (`null`
 * on an existence-only column).
 *
 * @since 0.1.139
 */
export function columnDefaultCondition(column: FilterableColumn): FilterConditionType {
  return columnFilter(column).defaultCondition;
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
  return columnFilter(column).conditions.length > 0;
}
