import { getZoneFormat } from "../utils/intl-cache";
import type { FilterCondition } from "./filter-types";

/**
 * Temporal filter values and the encoder that turns them into what the
 * server's filter guard accepts.
 *
 * The filter MODEL stays in calendar terms (`2026-10-05`, `today-6`, `month`):
 * URLs and presets keep that human-readable, relative form. A value is encoded
 * to epoch milliseconds / ISO strings / `YYYY-MM-DD` only when the query is
 * built, in the viewer's time zone — see `createColumnValueEncoder`.
 *
 * @since 0.1.148
 */

/** A half-open period `[start, end)` in epoch milliseconds. */
export interface TemporalPeriod {
  start: number;
  end: number;
}

/** @since 0.1.148 */
export interface TemporalOptions {
  /** IANA time zone; the runtime's local zone when omitted (or invalid). */
  timeZone?: string;
  /** First day of the week, `1` = Monday … `7` = Sunday. Default `1`. */
  weekStart?: number;
  /** "Now" in epoch ms — `Date.now()` when omitted. Read per call. */
  now?: number;
}

// ── Value grammar ────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINUTE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const RELATIVE_RE = /^(today|week|month|year)(?:-(\d{1,4}))?$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export type RelativeUnit = "today" | "week" | "month" | "year";

export type ParsedTemporal =
  | { kind: "day"; y: number; m: number; d: number }
  | { kind: "minute"; y: number; m: number; d: number; h: number; mi: number }
  | { kind: "month"; y: number; m: number }
  | { kind: "relative"; unit: RelativeUnit; n: number }
  | { kind: "instant"; ms: number }
  | { kind: "epoch"; ms: number };

function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Parse a temporal value; `undefined` when it is not one. @internal */
export function parseTemporal(v: unknown): ParsedTemporal | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? { kind: "epoch", ms: v } : undefined;
  if (typeof v !== "string") return undefined;
  let m = DAY_RE.exec(v);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return validDay(y, mo, d) ? { kind: "day", y, m: mo, d } : undefined;
  }
  m = MINUTE_RE.exec(v);
  if (m) {
    const [y, mo, d, h, mi] = [+m[1], +m[2], +m[3], +m[4], +m[5]];
    return validDay(y, mo, d) && h < 24 && mi < 60
      ? { kind: "minute", y, m: mo, d, h, mi }
      : undefined;
  }
  m = MONTH_RE.exec(v);
  if (m) {
    const [y, mo] = [+m[1], +m[2]];
    return mo >= 1 && mo <= 12 ? { kind: "month", y, m: mo } : undefined;
  }
  m = RELATIVE_RE.exec(v);
  if (m) return { kind: "relative", unit: m[1] as RelativeUnit, n: m[2] ? +m[2] : 0 };
  if (INSTANT_RE.test(v)) {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? undefined : { kind: "instant", ms };
  }
  return undefined;
}

/** The grammar kind of a temporal value (`"day"`, `"minute"`, …); `undefined` when it is not one. */
export function temporalKind(v: unknown): ParsedTemporal["kind"] | undefined {
  return parseTemporal(v)?.kind;
}

/**
 * Whether `v` is a temporal filter value: a day (`2026-10-05`), minute
 * (`2026-10-05T14:30`), month (`2026-10`), relative token (`today`,
 * `today-6`, `week`, `week-1`, `month`, `year`, …), ISO instant with `Z` or an
 * offset, or an epoch-millisecond number.
 */
export function isTemporalValue(v: unknown): boolean {
  return parseTemporal(v) !== undefined;
}

// ── Time-zone math ───────────────────────────────────────────

/** A usable zone name, or `undefined` for the runtime's local zone (an unknown zone warns once). */
function usableZone(tz: string | undefined): string | undefined {
  return tz && getZoneFormat(tz) ? tz : undefined;
}

// A zone's offset only changes at a transition, and every transition falls on
// a quarter hour of UTC, so one lookup per quarter hour is exact.
const OFFSET_BUCKET_MS = 900_000;
const offsets = new Map<string, number>();

/** `wall time as if UTC` minus the instant: the zone's UTC offset at `instant`, in ms. */
function zoneOffset(instant: number, zone: string): number {
  const bucket = Math.floor(instant / OFFSET_BUCKET_MS);
  const key = `${zone}|${bucket}`;
  let offset = offsets.get(key);
  if (offset === undefined) {
    const start = bucket * OFFSET_BUCKET_MS;
    const n: Record<string, number> = {};
    for (const p of getZoneFormat(zone)!.formatToParts(new Date(start))) {
      if (p.type !== "literal") n[p.type] = +p.value;
    }
    offset = Date.UTC(n.year, n.month - 1, n.day, n.hour, n.minute, n.second) - start;
    if (offsets.size >= 1000) offsets.clear();
    offsets.set(key, offset);
  }
  return offset;
}

/**
 * The instant at which `tz`'s wall clock reads `y-mo-d h:mi` (month 1-based;
 * overflowing fields normalize like `Date.UTC`). With no zone, the runtime's
 * local zone. A wall time skipped by a DST jump takes the later valid instant;
 * a repeated one the earlier.
 *
 * @internal
 */
export function zonedWallTimeToEpoch(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz?: string,
): number {
  const zone = usableZone(tz);
  if (!zone) {
    return new Date(y, mo - 1, d, h, mi).getTime();
  }
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const before = zoneOffset(guess - 86_400_000, zone);
  const after = zoneOffset(guess + 86_400_000, zone);
  const valid: number[] = [];
  for (const off of new Set([before, after])) {
    const t = guess - off;
    if (zoneOffset(t, zone) === off) valid.push(t);
  }
  // Two: the clock repeats (take the first). None: it jumps over (the offset
  // from before the jump lands on the later side).
  return valid.length > 0 ? Math.min(...valid) : guess - before;
}

/** @internal */
export interface WallDate {
  y: number;
  m: number;
  d: number;
}

interface WallTime extends WallDate {
  h: number;
  mi: number;
}

/** The wall-clock reading of `instant` on `tz`'s clock (the local zone when `tz` is unusable). @internal */
export function wallTimeOf(instant: number, tz: string | undefined): WallTime {
  const zone = usableZone(tz);
  const shifted = new Date(
    zone
      ? instant + zoneOffset(instant, zone)
      : instant - new Date(instant).getTimezoneOffset() * 60_000,
  );
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
  };
}

/** @internal */
export function addDays(date: WallDate, days: number): WallDate {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function dayOfWeek(date: WallDate): number {
  return new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay() || 7;
}

/** `YYYY-MM-DD` of a calendar date. @internal */
export function formatDay(date: WallDate): string {
  return `${String(date.y).padStart(4, "0")}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
}

// ── Periods ──────────────────────────────────────────────────

function dayPeriod(date: WallDate, tz: string | undefined): TemporalPeriod {
  return {
    start: zonedWallTimeToEpoch(date.y, date.m, date.d, 0, 0, tz),
    end: zonedWallTimeToEpoch(date.y, date.m, date.d + 1, 0, 0, tz),
  };
}

/** What a period needs besides the value: the zone, the week start and "today" (resolved on first use). @internal */
export interface PeriodContext {
  tz?: string;
  weekStart?: number;
  today: () => WallDate;
}

/** The period an already parsed temporal value denotes. @internal */
export function periodOf(p: ParsedTemporal, ctx: PeriodContext): TemporalPeriod {
  const { tz } = ctx;
  switch (p.kind) {
    case "day":
      return dayPeriod(p, tz);
    case "minute": {
      const start = zonedWallTimeToEpoch(p.y, p.m, p.d, p.h, p.mi, tz);
      return { start, end: start + 60_000 };
    }
    case "month":
      return {
        start: zonedWallTimeToEpoch(p.y, p.m, 1, 0, 0, tz),
        end: zonedWallTimeToEpoch(p.y, p.m + 1, 1, 0, 0, tz),
      };
    case "instant":
    case "epoch":
      return { start: p.ms, end: p.ms + 1 };
    case "relative": {
      const today = ctx.today();
      if (p.unit === "today") return dayPeriod(addDays(today, -p.n), tz);
      if (p.unit === "week") {
        const weekStart = Math.min(7, Math.max(1, Math.trunc(ctx.weekStart ?? 1)));
        const back = (dayOfWeek(today) - weekStart + 7) % 7;
        const first = addDays(today, -back - 7 * p.n);
        const next = addDays(first, 7);
        return {
          start: zonedWallTimeToEpoch(first.y, first.m, first.d, 0, 0, tz),
          end: zonedWallTimeToEpoch(next.y, next.m, next.d, 0, 0, tz),
        };
      }
      if (p.unit === "month") {
        const m = today.m - p.n;
        return {
          start: zonedWallTimeToEpoch(today.y, m, 1, 0, 0, tz),
          end: zonedWallTimeToEpoch(today.y, m + 1, 1, 0, 0, tz),
        };
      }
      return {
        start: zonedWallTimeToEpoch(today.y - p.n, 1, 1, 0, 0, tz),
        end: zonedWallTimeToEpoch(today.y - p.n + 1, 1, 1, 0, 0, tz),
      };
    }
  }
}

/** The period context for `opts`: "today" is read from `now` (or the clock) once, when first needed. @internal */
export function periodContext(opts: TemporalOptions, now = opts.now ?? Date.now()): PeriodContext {
  let today: WallDate | undefined;
  return {
    tz: opts.timeZone,
    weekStart: opts.weekStart,
    today: () => (today ??= wallTimeOf(now, opts.timeZone)),
  };
}

/**
 * The period a temporal value denotes in the given zone; `undefined` when it
 * is not temporal.
 *
 * @internal
 */
export function resolveTemporalPeriod(
  v: string | number,
  opts: TemporalOptions = {},
): TemporalPeriod | undefined {
  const parsed = parseTemporal(v);
  return parsed && periodOf(parsed, periodContext(opts));
}

/**
 * A temporal value as the text a native date input holds: the start of the
 * period it denotes on the zone's clock — `YYYY-MM-DD` (`"day"`) or
 * `YYYY-MM-DDTHH:mm` (`"minute"`). Used to turn a relative token or an epoch
 * number into something editable. `undefined` for a non-temporal value.
 *
 * @internal Shared with `@atscript/vue-table`.
 */
export function temporalInputValue(
  v: string | number,
  precision: "day" | "minute",
  opts: TemporalOptions = {},
): string | undefined {
  const period = resolveTemporalPeriod(v, opts);
  if (!period) return undefined;
  const t = wallTimeOf(period.start, opts.timeZone);
  const day = formatDay(t);
  return precision === "day"
    ? day
    : `${day}T${String(t.h).padStart(2, "0")}:${String(t.mi).padStart(2, "0")}`;
}

// ── Shortcuts ────────────────────────────────────────────────

/** A one-click temporal filter. Its conditions use relative tokens, so a saved filter stays relative. */
export interface TemporalShortcut {
  id: string;
  label: string;
  conditions: FilterCondition[];
}

const eq = (v: string): FilterCondition => ({ type: "eq", value: [v] });
const bw = (a: string, b: string): FilterCondition => ({ type: "bw", value: [a, b] });

/**
 * Quick temporal filters for a date or date-time filter (both offer the same). They carry relative
 * tokens (`today-6`…`today`), so "Last 7 days" means the last 7 days whenever
 * the filter is applied — in a preset or a shared link too.
 *
 * Replaces the absolute {@link dateShortcuts}. Since 0.1.148.
 */
export function temporalShortcuts(): TemporalShortcut[] {
  return [
    { id: "today", label: "Today", conditions: [eq("today")] },
    { id: "yesterday", label: "Yesterday", conditions: [eq("today-1")] },
    { id: "last-7-days", label: "Last 7 days", conditions: [bw("today-6", "today")] },
    { id: "last-30-days", label: "Last 30 days", conditions: [bw("today-29", "today")] },
    { id: "this-week", label: "This week", conditions: [eq("week")] },
    { id: "last-week", label: "Last week", conditions: [eq("week-1")] },
    { id: "this-month", label: "This month", conditions: [eq("month")] },
    { id: "last-month", label: "Last month", conditions: [eq("month-1")] },
    { id: "this-year", label: "This year", conditions: [eq("year")] },
  ];
}
