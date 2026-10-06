import type { ColumnDef } from "@atscript/ui";
import type { FilterExpr } from "@uniqu/core";
import { columnFilter, type ValueEncoding } from "./column-filter";
import { conditionToExpr } from "./condition-to-expr";
import type { FilterCondition } from "./filter-types";
import {
  addDays,
  formatDay,
  parseTemporal,
  type ParsedTemporal,
  periodContext,
  periodOf,
  wallTimeOf,
  type TemporalOptions,
  type TemporalPeriod,
} from "./temporal";
import { coerceBoolean, coerceNumericText } from "./value-coerce";

/**
 * Turns one filter condition into the expression to send. `undefined` means
 * "no opinion" — the default conversion runs. `now` is the clock reading of
 * the query being built, so every relative date in it means the same "today".
 *
 * @since 0.1.148
 */
export type ConditionEncoder = (
  field: string,
  cond: FilterCondition,
  now?: number,
) => FilterExpr | undefined;

type TemporalEncoding = Extract<ValueEncoding, "epoch" | "iso" | "date" | "dateText">;

/**
 * The `[start, end)` bounds in storage form. A `date` column stores calendar
 * days, so an instant's precision is cut to its day and `end` is the day
 * after the last one the period touches.
 */
function encodePeriod(
  encoding: TemporalEncoding,
  { start, end }: TemporalPeriod,
  tz: string | undefined,
): { s: number | string; e: number | string } {
  switch (encoding) {
    case "epoch":
      return { s: start, e: end };
    case "iso":
      return { s: new Date(start).toISOString(), e: new Date(end).toISOString() };
    default:
      return {
        s: formatDay(wallTimeOf(start, tz)),
        e: formatDay(addDays(wallTimeOf(end - 1, tz), 1)),
      };
  }
}

const isEpoch = (v: unknown) => typeof v === "number";

const hasTimeOfDay = (p: ParsedTemporal) =>
  p.kind === "minute" || p.kind === "instant" || p.kind === "epoch";

function encodeTemporalCondition(
  field: string,
  cond: FilterCondition,
  encoding: TemporalEncoding,
  opts: TemporalOptions,
  now: number,
): FilterExpr | undefined {
  if (cond.type === "null" || cond.type === "notNull") return undefined;
  const tz = opts.timeZone;
  const ctx = periodContext(opts, now);
  const [a, b] = cond.value;

  // An epoch number against an epoch column is an exact instant: the plain
  // comparison is already right (app-built links and old deep links).
  if (encoding === "epoch") {
    if (cond.type !== "bw" ? isEpoch(a) : isEpoch(a) && isEpoch(b)) return undefined;
  }

  const first = parseTemporal(a);
  // An unresolvable value is sent as typed: the server answers with a clear
  // 400 rather than the filter quietly meaning something else.
  if (!first) return undefined;
  // A plain string column may hold date-times: a time of day is not cut to its day.
  const keepsTime = encoding === "dateText";
  if (keepsTime && hasTimeOfDay(first)) return undefined;
  const A = encodePeriod(encoding, periodOf(first, ctx), tz);

  switch (cond.type) {
    case "eq":
      return { [field]: { $gte: A.s, $lt: A.e } } as FilterExpr;
    case "ne":
      return { $or: [{ [field]: { $lt: A.s } }, { [field]: { $gte: A.e } }] } as FilterExpr;
    case "lt":
      return { [field]: { $lt: A.s } } as FilterExpr;
    case "lte":
      return { [field]: { $lt: A.e } } as FilterExpr;
    case "gt":
      return { [field]: { $gte: A.e } } as FilterExpr;
    case "gte":
      return { [field]: { $gte: A.s } } as FilterExpr;
    case "bw": {
      const last = parseTemporal(b);
      if (!last || (keepsTime && hasTimeOfDay(last))) return undefined;
      const B = encodePeriod(encoding, periodOf(last, ctx), tz);
      return { [field]: { $gte: A.s, $lt: B.e } } as FilterExpr;
    }
    default:
      return undefined;
  }
}

/** Conditions whose values are compared as the column's own type (not text patterns, not existence). */
const VALUE_CONDITIONS = new Set<FilterCondition["type"]>([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "bw",
]);

/** One value typed for a scalar encoding; anything that is not one of its forms stays as it is. */
function typeScalar(
  encoding: ValueEncoding,
  v: string | number | boolean,
): string | number | boolean {
  switch (encoding) {
    case "boolean":
      return coerceBoolean(v) ?? v;
    case "number":
    case "integer":
      return typeof v === "string" ? (coerceNumericText(v, encoding) ?? v) : v;
    case "decimal":
      // Decimals are strings end to end (a JS number would round them).
      return typeof v === "number" && Number.isFinite(v) ? String(v) : v;
    default:
      return v;
  }
}

function encodeScalarCondition(
  field: string,
  cond: FilterCondition,
  encoding: ValueEncoding,
): FilterExpr | undefined {
  if (!VALUE_CONDITIONS.has(cond.type)) return undefined;
  const value = cond.value.map((v) => typeScalar(encoding, v));
  return value.some((v, i) => v !== cond.value[i])
    ? conditionToExpr(field, { ...cond, value })
    : undefined;
}

/**
 * The one choke point where a typed filter value becomes what the server's
 * filter guard accepts, per column (by `columnFilter(column).encoding`):
 *
 * - **Temporal columns** (`date` / `datetime` filter kind with a `valueKind`):
 *   a day, minute, month, relative token, instant or epoch number becomes the
 *   period it denotes in the viewer's zone, as epoch ms (`timestamp`, numeric
 *   columns), ISO strings (`isoDate`) or `YYYY-MM-DD` (`date`). `eq` is "on",
 *   `lt` / `gte` compare against the period start, `lte` / `gt` against its
 *   end, `bw` runs from the first period's start to the second's end.
 * - **Boolean columns**: `"true"` / `"false"` text becomes a boolean.
 * - **Number / integer columns**: numeric text becomes a number, so a value
 *   from a URL or a preset reaches the server typed like one typed in.
 * - **Decimal columns**: numbers become strings, like typed-in values.
 * - **Distinct-picker columns** (`column.distinct`, stored as `isoDate`): a full instant
 *   (`eq` / `ne`) is a value the server listed itself, so it is sent exactly as picked
 *   (a raw `$eq` / `$ne`) instead of becoming a millisecond range.
 * - Anything else — including fields without a `valueKind` — returns
 *   `undefined`, so the default conversion runs.
 *
 * Pass the result as `encode` to `filtersToUniqueryFilter` or as
 * `encodeCondition` to `buildTableQuery`. "Today" is `opts.now`, else the
 * `now` the caller passes per query, else the clock.
 *
 * @since 0.1.148
 */
export function createColumnValueEncoder(
  columns: readonly Pick<ColumnDef, "path" | "type" | "valueKind" | "distinct">[],
  opts: TemporalOptions = {},
): ConditionEncoder {
  const plan = new Map<string, ValueEncoding>();
  /** Columns whose picker lists the server's own stored values (`@ui.valueHelp.distinct`). */
  const stored = new Set<string>();
  for (const column of columns) {
    const { encoding } = columnFilter(column);
    if (encoding) plan.set(column.path, encoding);
    if (column.distinct) stored.add(column.path);
  }
  if (plan.size === 0) return () => undefined;

  return (field, cond, now) => {
    const encoding = plan.get(field);
    if (!encoding) return undefined;
    // A full instant picked from the column's own distinct list IS a stored string (maybe
    // without milliseconds, maybe with an offset): sent as is, an exact `$eq`, never widened
    // to a one-millisecond range that the stored string would fall outside of.
    if (
      encoding === "iso" &&
      stored.has(field) &&
      (cond.type === "eq" || cond.type === "ne") &&
      typeof cond.value[0] === "string" &&
      parseTemporal(cond.value[0])?.kind === "instant"
    ) {
      return undefined;
    }
    return encoding === "epoch" ||
      encoding === "iso" ||
      encoding === "date" ||
      encoding === "dateText"
      ? encodeTemporalCondition(field, cond, encoding, opts, opts.now ?? now ?? Date.now())
      : encodeScalarCondition(field, cond, encoding);
  };
}
