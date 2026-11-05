import { optionLabel, getUiTexts, type ColumnDef, type UiT } from "@atscript/ui";
import { columnFilterKind } from "./column-filter";
import { isTemporalKind } from "./filter-conditions-map";
import { formatFilterCondition } from "./filter-input-format";
import type { FilterCondition } from "./filter-types";
import {
  parseTemporal,
  TEMPORAL_SHORTCUTS,
  type ParsedTemporal,
  type RelativeUnit,
  type TemporalOptions,
} from "./temporal";
import { getDateTimeFormat } from "../utils/intl-cache";

/** @since 0.1.148 */
export type FormatColumnConditionOptions = TemporalOptions & {
  /** BCP 47 locale for dates; the runtime default when omitted. */
  locale?: string;
  /** Reads the wording's UI texts; the active UI locale's when omitted. */
  t?: UiT;
};

/** UI text codes of a relative token, by unit: `n = 0`, `n = 1`, `n > 1`. */
const RELATIVE: Record<RelativeUnit, [string, string, string]> = {
  today: ["UI_FILTER_TODAY", "UI_FILTER_YESTERDAY", "UI_FILTER_DAYS_AGO"],
  week: ["UI_FILTER_THIS_WEEK", "UI_FILTER_LAST_WEEK", "UI_FILTER_WEEKS_AGO"],
  month: ["UI_FILTER_THIS_MONTH", "UI_FILTER_LAST_MONTH", "UI_FILTER_MONTHS_AGO"],
  year: ["UI_FILTER_THIS_YEAR", "UI_FILTER_LAST_YEAR", "UI_FILTER_YEARS_AGO"],
};

/** A relative token in words: `today`, `yesterday`, `3 days ago`, `this week`, `last month`. */
function formatRelative(unit: RelativeUnit, n: number, t: UiT): string {
  return t(RELATIVE[unit][Math.min(n, 2)], { count: n });
}

/** A wall-clock reading formatted as it reads, without any zone shift. */
function formatWall(
  p: { y: number; m: number; d: number; h?: number; mi?: number },
  locale: string | undefined,
  withYear = true,
): string {
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d, p.h ?? 0, p.mi ?? 0));
  return getDateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear && { year: "numeric" }),
    ...(p.h !== undefined && { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  }).format(date);
}

/** An instant on the table zone's clock (the runtime's own when the zone is unknown). */
function formatInstant(ms: number, opts: FormatColumnConditionOptions): string {
  return getDateTimeFormat(opts.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(opts.timeZone && { timeZone: opts.timeZone }),
  }).format(new Date(ms));
}

/** One parsed temporal value in words — `Oct 5, 2026`, `2 days ago`, `Oct 5, 2026, 14:30`. */
function formatTemporal(p: ParsedTemporal, opts: FormatColumnConditionOptions): string {
  switch (p.kind) {
    case "day":
    case "minute":
      return formatWall(p, opts.locale);
    case "month":
      return getDateTimeFormat(opts.locale, {
        timeZone: "UTC",
        month: "short",
        year: "numeric",
      }).format(new Date(Date.UTC(p.y, p.m - 1, 1)));
    case "relative":
      return formatRelative(p.unit, p.n, opts.t ?? getUiTexts().t);
    case "instant":
    case "epoch":
      return formatInstant(p.ms, opts);
  }
}

/** A value in words when it is temporal, as plain text otherwise. */
function formatValue(v: unknown, opts: FormatColumnConditionOptions): string {
  const p = parseTemporal(v);
  return p ? formatTemporal(p, opts) : String(v);
}

/** `Oct 1 – Oct 5, 2026`: the first bound drops its year when both fall in the same one. */
function formatBetween(a: unknown, b: unknown, opts: FormatColumnConditionOptions): string {
  const pa = parseTemporal(a);
  const pb = parseTemporal(b);
  if (pa?.kind === "day" && pb?.kind === "day" && pa.y === pb.y) {
    return `${formatWall(pa, opts.locale, false)} – ${formatWall(pb, opts.locale)}`;
  }
  const word = (p: ParsedTemporal | undefined, v: unknown) =>
    p ? formatTemporal(p, opts) : String(v);
  return `${word(pa, a)} – ${word(pb, b)}`;
}

/** The shortcut a condition is exactly, if any (compared by value — they are single conditions). */
function shortcutCode(cond: FilterCondition): string | undefined {
  for (const { condition: c, code } of TEMPORAL_SHORTCUTS) {
    if (c.type === cond.type && c.value.length === cond.value.length) {
      if (c.value.every((v, i) => v === cond.value[i])) return code;
    }
  }
  return undefined;
}

/** UI text codes of the comparisons on a date column, with the date as `{date}`. */
const DATE_COMPARISONS: Partial<Record<FilterCondition["type"], string>> = {
  ne: "UI_FILTER_NOT_ON_DATE",
  lt: "UI_FILTER_BEFORE_DATE",
  lte: "UI_FILTER_ON_OR_BEFORE_DATE",
  gt: "UI_FILTER_AFTER_DATE",
  gte: "UI_FILTER_ON_OR_AFTER_DATE",
};

/** `eq` / `ne` conditions on a union column show the option labels, not the raw literals. */
function withOptionLabels(
  column: Pick<ColumnDef, "options">,
  cond: FilterCondition,
): FilterCondition {
  if (!column.options?.length || (cond.type !== "eq" && cond.type !== "ne")) return cond;
  return { ...cond, value: cond.value.map((v) => optionLabel(column, v) ?? v) };
}

/**
 * A filter condition as a chip label, worded for the column. On a date or
 * date-time column an exact shortcut shows its name ("Last 7 days"); anything
 * else reads as an operator word plus dates in the table's zone and locale
 * ("on Oct 5, 2026", "Oct 1 – Oct 5, 2026", "after Oct 5, 2026, 14:30",
 * "last month"). Other columns use `formatFilterCondition`.
 *
 * @internal Shared with `@atscript/vue-table`.
 */
export function formatColumnCondition(
  column: Pick<ColumnDef, "type" | "valueKind" | "options">,
  cond: FilterCondition,
  opts: FormatColumnConditionOptions = {},
): string {
  if (!isTemporalKind(columnFilterKind(column))) {
    return formatFilterCondition(withOptionLabels(column, cond));
  }

  const t = opts.t ?? getUiTexts().t;
  const shortcut = shortcutCode(cond);
  if (shortcut) return t(shortcut);

  const [a, b] = cond.value;
  switch (cond.type) {
    case "null":
      return t("UI_FILTER_EMPTY");
    case "notNull":
      return t("UI_FILTER_NOT_EMPTY");
    case "bw":
      return formatBetween(a, b, opts);
    case "eq": {
      const p = parseTemporal(a);
      if (p?.kind === "relative") return formatTemporal(p, opts); // already reads as a period
      if (p?.kind === "month") return t("UI_FILTER_IN_MONTH", { date: formatTemporal(p, opts) });
      return t("UI_FILTER_ON_DATE", { date: p ? formatTemporal(p, opts) : String(a) });
    }
    default: {
      const code = DATE_COMPARISONS[cond.type];
      return code ? t(code, { date: formatValue(a, opts) }) : formatFilterCondition(cond);
    }
  }
}

/**
 * A single value on a column as a display string: a temporal value on a date
 * or date-time column in words, anything else `undefined`. For
 * `formatFilterExpr`'s `formatValue`.
 *
 * @internal Shared with `@atscript/vue-table`.
 */
export function formatColumnValue(
  column: Pick<ColumnDef, "type" | "valueKind" | "options">,
  value: unknown,
  opts: FormatColumnConditionOptions = {},
): string | undefined {
  if (!isTemporalKind(columnFilterKind(column))) return optionLabel(column, value);
  const p = parseTemporal(value);
  return p ? formatTemporal(p, opts) : undefined;
}
