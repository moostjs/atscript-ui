import { afterEach, describe, expect, it, vi } from "vitest";
import { createColumnValueEncoder } from "./value-encoder";
import { filtersToUniqueryFilter } from "./filters-to-uniquery";
import type { FilterCondition } from "./filter-types";

const BERLIN = { timeZone: "Europe/Berlin" };
const H = 3_600_000;

afterEach(() => vi.restoreAllMocks());

describe("createColumnValueEncoder", () => {
  const columns = [
    { path: "ts", type: "datetime", valueKind: "timestamp" },
    { path: "iso", type: "text", valueKind: "isoDate" },
    { path: "day", type: "text", valueKind: "date" },
    { path: "isoAsDate", type: "date", valueKind: "isoDate" },
    { path: "rawMs", type: "number", valueKind: "timestamp" },
    { path: "flag", type: "boolean", valueKind: "boolean" },
    { path: "dec", type: "number", valueKind: "decimal" },
    { path: "n", type: "number", valueKind: "number" },
    { path: "legacy", type: "date" },
    { path: "int", type: "number", valueKind: "integer" },
    { path: "text", type: "date", valueKind: "string" },
  ] as const;
  const opts = { ...BERLIN, now: Date.UTC(2026, 9, 5, 12) };
  const enc = createColumnValueEncoder(columns, opts);
  const c = (type: FilterCondition["type"], ...value: (string | number | boolean)[]) =>
    ({ type, value }) as FilterCondition;
  const D5 = Date.UTC(2026, 9, 4, 22);
  const D6 = Date.UTC(2026, 9, 5, 22);

  it("timestamp: every operator as epoch ms", () => {
    expect(enc("ts", c("eq", "2026-10-05"))).toEqual({ ts: { $gte: D5, $lt: D6 } });
    expect(enc("ts", c("ne", "2026-10-05"))).toEqual({
      $or: [{ ts: { $lt: D5 } }, { ts: { $gte: D6 } }],
    });
    expect(enc("ts", c("lt", "2026-10-05"))).toEqual({ ts: { $lt: D5 } });
    expect(enc("ts", c("lte", "2026-10-05"))).toEqual({ ts: { $lt: D6 } });
    expect(enc("ts", c("gt", "2026-10-05"))).toEqual({ ts: { $gte: D6 } });
    expect(enc("ts", c("gte", "2026-10-05"))).toEqual({ ts: { $gte: D5 } });
    expect(enc("ts", c("bw", "2026-10-01", "2026-10-05"))).toEqual({
      ts: { $gte: Date.UTC(2026, 8, 30, 22), $lt: D6 },
    });
  });

  it("timestamp: minute precision, relative tokens, month", () => {
    expect(enc("ts", c("gte", "2026-10-05T14:30"))).toEqual({
      ts: { $gte: Date.UTC(2026, 9, 5, 12, 30) },
    });
    expect(enc("ts", c("bw", "today-6", "today"))).toEqual({
      ts: { $gte: Date.UTC(2026, 8, 28, 22), $lt: D6 },
    });
    expect(enc("ts", c("eq", "month"))).toEqual({
      ts: { $gte: Date.UTC(2026, 8, 30, 22), $lt: Date.UTC(2026, 9, 31, 23) },
    });
  });

  it("timestamp: epoch numbers keep the exact comparison", () => {
    expect(enc("ts", c("eq", 1759622400000))).toBeUndefined();
    expect(enc("ts", c("gt", 5))).toBeUndefined();
    expect(enc("ts", c("lte", 5))).toBeUndefined();
    expect(enc("ts", c("bw", 5, 9))).toBeUndefined();
    // a mixed range falls back to the periods
    expect(enc("ts", c("bw", 5, "2026-10-05"))).toEqual({ ts: { $gte: 5, $lt: D6 } });
  });

  it("an unresolvable string passes through for the server to refuse", () => {
    expect(enc("ts", c("eq", "abc"))).toBeUndefined();
    expect(enc("ts", c("bw", "2026-10-05", "abc"))).toBeUndefined();
  });

  it("null / notNull are left alone", () => {
    expect(enc("ts", c("null"))).toBeUndefined();
    expect(enc("ts", c("notNull"))).toBeUndefined();
  });

  it("isoDate: ISO instants", () => {
    expect(enc("iso", c("eq", "2026-10-05"))).toEqual({
      iso: { $gte: "2026-10-04T22:00:00.000Z", $lt: "2026-10-05T22:00:00.000Z" },
    });
    expect(enc("isoAsDate", c("gt", "today"))).toEqual({
      isoAsDate: { $gte: "2026-10-05T22:00:00.000Z" },
    });
  });

  it("date: YYYY-MM-DD, precision cut to the day", () => {
    expect(enc("day", c("eq", "2026-10-05"))).toEqual({
      day: { $gte: "2026-10-05", $lt: "2026-10-06" },
    });
    expect(enc("day", c("eq", "2026-10-05T23:59"))).toEqual({
      day: { $gte: "2026-10-05", $lt: "2026-10-06" },
    });
    expect(enc("day", c("lte", "2026-10-05"))).toEqual({ day: { $lt: "2026-10-06" } });
    expect(enc("day", c("gt", "2026-10-05"))).toEqual({ day: { $gte: "2026-10-06" } });
    expect(enc("day", c("eq", "month"))).toEqual({
      day: { $gte: "2026-10-01", $lt: "2026-11-01" },
    });
    expect(enc("day", c("bw", "today-6", "today"))).toEqual({
      day: { $gte: "2026-09-29", $lt: "2026-10-06" },
    });
    // an epoch number is read on the table's clock
    expect(enc("day", c("eq", Date.UTC(2026, 9, 5, 22, 30)))).toEqual({
      day: { $gte: "2026-10-06", $lt: "2026-10-07" },
    });
  });

  it("a number column displayed as a number keeps its raw comparisons", () => {
    expect(enc("rawMs", c("gte", 5))).toBeUndefined();
  });

  it("boolean text becomes a boolean", () => {
    expect(enc("flag", c("eq", "true"))).toEqual({ flag: true });
    expect(enc("flag", c("eq", "TRUE"))).toEqual({ flag: true });
    expect(enc("flag", c("ne", "false"))).toEqual({ flag: { $ne: false } });
    expect(enc("flag", c("eq", true))).toBeUndefined();
    expect(enc("flag", c("eq", "yes"))).toBeUndefined();
  });

  it("number / integer columns type numeric text (a URL or preset value reaches the server typed)", () => {
    expect(enc("n", c("eq", "5"))).toEqual({ n: 5 });
    expect(enc("n", c("gt", "5.5"))).toEqual({ n: { $gt: 5.5 } });
    expect(enc("int", c("bw", "1", "9"))).toEqual({ int: { $gte: 1, $lte: 9 } });
    expect(enc("n", c("eq", 5))).toBeUndefined();
    // not a number: left for the server to refuse
    expect(enc("n", c("eq", "abc"))).toBeUndefined();
    expect(enc("int", c("eq", "5.5"))).toBeUndefined();
  });

  it("decimal columns keep their values as strings, even a number from a URL", () => {
    expect(enc("dec", c("eq", "12.50"))).toBeUndefined();
    expect(enc("dec", c("gt", 100))).toEqual({ dec: { $gt: "100" } });
    expect(enc("dec", c("bw", 1, "2.5"))).toEqual({ dec: { $gte: "1", $lte: "2.5" } });
  });

  it("unknown fields and fields without a valueKind are untouched", () => {
    expect(enc("nope", c("eq", "2026-10-05"))).toBeUndefined();
    expect(enc("legacy", c("eq", "2026-10-05"))).toBeUndefined();
  });

  it("a string-stored date column is not widened by a time of day", () => {
    // a day is exact for ISO text (it is a lexical prefix) ...
    expect(enc("text", c("eq", "2026-10-05"))).toEqual({
      text: { $gte: "2026-10-05", $lt: "2026-10-06" },
    });
    // ... but a minute or an instant would be silently cut to its day: sent as typed instead
    expect(enc("text", c("gte", "2026-10-05T14:30"))).toBeUndefined();
    expect(enc("text", c("lt", "2026-10-05T12:00:00Z"))).toBeUndefined();
    expect(enc("text", c("bw", "2026-10-01", "2026-10-05T14:30"))).toBeUndefined();
    // a date-typed (YYYY-MM-DD) column truncates by design
    expect(enc("day", c("gte", "2026-10-05T14:30"))).toEqual({ day: { $gte: "2026-10-05" } });
  });

  it("uses the 'now' the caller passes, and pinned options win", () => {
    const live = createColumnValueEncoder(columns, BERLIN);
    const tomorrow = Date.UTC(2026, 9, 6, 12);
    expect(live("ts", c("eq", "today"), tomorrow)).toEqual({ ts: { $gte: D6, $lt: D6 + 24 * H } });
    expect(enc("ts", c("eq", "today"), tomorrow)).toEqual({ ts: { $gte: D5, $lt: D6 } });
  });

  it("works through filtersToUniqueryFilter: ne is AND-ed, inclusions OR-ed", () => {
    const filter = filtersToUniqueryFilter(
      {
        ts: [c("eq", "2026-10-05"), c("eq", "2026-10-07")],
        iso: [c("ne", "2026-10-05")],
        flag: [c("eq", "false")],
      },
      { encode: enc },
    );
    expect(filter).toEqual({
      $and: [
        {
          $or: [
            { ts: { $gte: D5, $lt: D6 } },
            { ts: { $gte: Date.UTC(2026, 9, 6, 22), $lt: Date.UTC(2026, 9, 7, 22) } },
          ],
        },
        {
          $or: [
            { iso: { $lt: "2026-10-04T22:00:00.000Z" } },
            { iso: { $gte: "2026-10-05T22:00:00.000Z" } },
          ],
        },
        { flag: false },
      ],
    });
  });

  it("reads the clock when neither pinned nor passed", () => {
    vi.useFakeTimers();
    try {
      const live = createColumnValueEncoder(columns, BERLIN);
      vi.setSystemTime(Date.UTC(2026, 9, 5, 12));
      expect(live("ts", c("eq", "today"))).toEqual({ ts: { $gte: D5, $lt: D6 } });
      vi.setSystemTime(Date.UTC(2026, 9, 6, 12));
      expect(live("ts", c("eq", "today"))).toEqual({ ts: { $gte: D6, $lt: D6 + 24 * H } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("filtersToUniqueryFilter reads the clock once per query", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 9, 5, 12));
    const live = createColumnValueEncoder(columns, BERLIN);
    filtersToUniqueryFilter({ ts: [c("eq", "today")], iso: [c("eq", "today")] }, { encode: live });
    expect(now).toHaveBeenCalledTimes(1);
  });

  it("an encoder with no typed column is a no-op", () => {
    expect(
      createColumnValueEncoder([{ path: "a", type: "text" }])("a", c("eq", "x")),
    ).toBeUndefined();
  });
});
