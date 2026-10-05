import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTemporalValue,
  resolveTemporalPeriod,
  temporalKind,
  temporalShortcuts,
  zonedWallTimeToEpoch,
} from "./temporal";

const BERLIN = { timeZone: "Europe/Berlin" };
const H = 3_600_000;

afterEach(() => vi.restoreAllMocks());

describe("isTemporalValue", () => {
  it("accepts the grammar", () => {
    for (const v of [
      "2026-10-05",
      "2026-10-05T14:30",
      "2026-10",
      "today",
      "today-6",
      "week",
      "week-1",
      "month",
      "month-12",
      "year",
      "year-1",
      "2026-10-05T12:00:00Z",
      "2026-10-05T12:00:00+02:00",
      "2026-10-05T12:00:00.250Z",
      1759622400000,
      0,
    ]) {
      expect(isTemporalValue(v), JSON.stringify(v)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const v of [
      "abc",
      "",
      "2026-13-01",
      "2026-02-30",
      "2026-10-05T25:00",
      "2026-10-05T14:30:15",
      "tomorrow",
      "today+1",
      "2026",
      "10/05/2026",
      true,
      null,
      undefined,
      Number.NaN,
      {},
    ]) {
      expect(isTemporalValue(v), JSON.stringify(v)).toBe(false);
    }
  });
});

describe("temporalKind", () => {
  it("names the grammar kind, calendar-validated", () => {
    expect(temporalKind("2026-10-05")).toBe("day");
    expect(temporalKind("2026-10-05T14:30")).toBe("minute");
    expect(temporalKind("2026-10")).toBe("month");
    expect(temporalKind("today-6")).toBe("relative");
    expect(temporalKind("2026-10-05T12:00:00Z")).toBe("instant");
    expect(temporalKind(1759622400000)).toBe("epoch");
    expect(temporalKind("2026-02-30")).toBeUndefined();
    expect(temporalKind("abc")).toBeUndefined();
  });
});

describe("zonedWallTimeToEpoch", () => {
  it("is exact outside DST changes", () => {
    expect(zonedWallTimeToEpoch(2026, 7, 1, 0, 0, "Europe/Berlin")).toBe(Date.UTC(2026, 5, 30, 22));
    expect(zonedWallTimeToEpoch(2026, 1, 1, 0, 0, "Europe/Berlin")).toBe(
      Date.UTC(2025, 11, 31, 23),
    );
  });

  it("takes the later instant for a wall time inside a spring-forward gap", () => {
    // 2026-03-29 02:30 does not exist in Berlin; 03:30 CEST = 01:30Z.
    expect(zonedWallTimeToEpoch(2026, 3, 29, 2, 30, "Europe/Berlin")).toBe(
      Date.UTC(2026, 2, 29, 1, 30),
    );
  });

  it("takes the first of a repeated fall-back hour", () => {
    // 2026-10-25 02:30 happens twice in Berlin; the first is CEST = 00:30Z.
    expect(zonedWallTimeToEpoch(2026, 10, 25, 2, 30, "Europe/Berlin")).toBe(
      Date.UTC(2026, 9, 25, 0, 30),
    );
  });

  it("without a zone uses the runtime's local clock", () => {
    expect(zonedWallTimeToEpoch(2026, 10, 5, 14, 30)).toBe(new Date(2026, 9, 5, 14, 30).getTime());
  });
});

describe("resolveTemporalPeriod", () => {
  it("day / minute / month in Europe/Berlin", () => {
    expect(resolveTemporalPeriod("2026-10-05", BERLIN)).toEqual({
      start: Date.UTC(2026, 9, 4, 22),
      end: Date.UTC(2026, 9, 5, 22),
    });
    expect(resolveTemporalPeriod("2026-10-05T14:30", BERLIN)).toEqual({
      start: Date.UTC(2026, 9, 5, 12, 30),
      end: Date.UTC(2026, 9, 5, 12, 31),
    });
    expect(resolveTemporalPeriod("2026-10", BERLIN)).toEqual({
      start: Date.UTC(2026, 8, 30, 22),
      end: Date.UTC(2026, 9, 31, 23),
    });
  });

  it("23- and 25-hour days across the Berlin changes", () => {
    const spring = resolveTemporalPeriod("2026-03-29", BERLIN)!;
    expect((spring.end - spring.start) / H).toBe(23);
    const fall = resolveTemporalPeriod("2026-10-25", BERLIN)!;
    expect((fall.end - fall.start) / H).toBe(25);
  });

  it("a half-hour DST zone (Lord Howe) keeps its 24.5-hour day", () => {
    const fall = resolveTemporalPeriod("2026-04-05", { timeZone: "Australia/Lord_Howe" })!;
    expect((fall.end - fall.start) / H).toBe(24.5);
    const spring = resolveTemporalPeriod("2026-10-04", { timeZone: "Australia/Lord_Howe" })!;
    expect((spring.end - spring.start) / H).toBe(23.5);
  });

  it("America/New_York and Pacific/Auckland (the date line)", () => {
    expect(resolveTemporalPeriod("2026-10-05", { timeZone: "America/New_York" })).toEqual({
      start: Date.UTC(2026, 9, 5, 4),
      end: Date.UTC(2026, 9, 6, 4),
    });
    expect(resolveTemporalPeriod("2026-10-05", { timeZone: "Pacific/Auckland" })).toEqual({
      start: Date.UTC(2026, 9, 4, 11),
      end: Date.UTC(2026, 9, 5, 11),
    });
  });

  it("relative tokens read today from the zone, not from UTC", () => {
    // 2026-10-05 23:30Z is already Oct 6 in Auckland and Berlin (01:30 CEST).
    const now = Date.UTC(2026, 9, 5, 23, 30);
    expect(resolveTemporalPeriod("today", { ...BERLIN, now })!.start).toBe(
      Date.UTC(2026, 9, 5, 22),
    );
    expect(resolveTemporalPeriod("today", { timeZone: "America/New_York", now })!.start).toBe(
      Date.UTC(2026, 9, 5, 4),
    );
    expect(resolveTemporalPeriod("today-1", { ...BERLIN, now })!.start).toBe(
      Date.UTC(2026, 9, 4, 22),
    );
  });

  it("week respects weekStart, week-1 is the week before", () => {
    // Wed 2026-10-07 12:00Z.
    const now = Date.UTC(2026, 9, 7, 12);
    const mon = resolveTemporalPeriod("week", { ...BERLIN, now })!;
    expect(mon.start).toBe(Date.UTC(2026, 9, 4, 22)); // Mon Oct 5 00:00 CEST
    expect(mon.end).toBe(Date.UTC(2026, 9, 11, 22)); // Mon Oct 12 00:00 CEST
    const sun = resolveTemporalPeriod("week", { ...BERLIN, now, weekStart: 7 })!;
    expect(sun.start).toBe(Date.UTC(2026, 9, 3, 22)); // Sun Oct 4
    const prev = resolveTemporalPeriod("week-1", { ...BERLIN, now })!;
    expect(prev.start).toBe(Date.UTC(2026, 8, 27, 22)); // Mon Sep 28
    expect(prev.end).toBe(mon.start);
  });

  it("month, month-N and year tokens", () => {
    const now = Date.UTC(2026, 0, 15, 12);
    expect(resolveTemporalPeriod("month-1", { ...BERLIN, now })).toEqual({
      start: Date.UTC(2025, 10, 30, 23),
      end: Date.UTC(2025, 11, 31, 23),
    });
    expect(resolveTemporalPeriod("year", { ...BERLIN, now })).toEqual({
      start: Date.UTC(2025, 11, 31, 23),
      end: Date.UTC(2026, 11, 31, 23),
    });
  });

  it("instants and epoch numbers are one millisecond", () => {
    expect(resolveTemporalPeriod("2026-10-05T12:00:00Z")).toEqual({
      start: Date.UTC(2026, 9, 5, 12),
      end: Date.UTC(2026, 9, 5, 12) + 1,
    });
    expect(resolveTemporalPeriod(5)).toEqual({ start: 5, end: 6 });
    expect(resolveTemporalPeriod("nope")).toBeUndefined();
  });

  it("with no zone falls back to the local clock", () => {
    const p = resolveTemporalPeriod("2026-10-05")!;
    expect(p.start).toBe(new Date(2026, 9, 5).getTime());
    expect(p.end).toBe(new Date(2026, 9, 6).getTime());
  });

  it("an invalid zone falls back to local and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const local = resolveTemporalPeriod("2026-10-05")!;
    expect(resolveTemporalPeriod("2026-10-05", { timeZone: "Mars/Olympus" })).toEqual(local);
    resolveTemporalPeriod("2026-10-06", { timeZone: "Mars/Olympus" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("temporalShortcuts", () => {
  it("are relative and unique", () => {
    const sc = temporalShortcuts();
    expect(new Set(sc.map((s) => s.id)).size).toBe(sc.length);
    expect(sc.find((s) => s.id === "last-7-days")!.conditions).toEqual([
      { type: "bw", value: ["today-6", "today"] },
    ]);
    expect(sc.map((s) => s.label)).toEqual([
      "Today",
      "Yesterday",
      "Last 7 days",
      "Last 30 days",
      "This week",
      "Last week",
      "This month",
      "Last month",
      "This year",
    ]);
    for (const s of sc) {
      for (const cond of s.conditions)
        for (const v of cond.value) expect(isTemporalValue(v)).toBe(true);
    }
  });
});

describe("temporalInputValue", () => {
  it("is the start of the period on the zone's clock", async () => {
    const { temporalInputValue } = await import("./temporal");
    const now = Date.UTC(2026, 9, 5, 23, 30); // Oct 6 01:30 in Berlin
    expect(temporalInputValue("today", "day", { ...BERLIN, now })).toBe("2026-10-06");
    expect(temporalInputValue("today-6", "day", { ...BERLIN, now })).toBe("2026-09-30");
    expect(temporalInputValue("month", "day", { ...BERLIN, now })).toBe("2026-10-01");
    expect(temporalInputValue(Date.UTC(2026, 9, 5, 12, 30), "minute", BERLIN)).toBe(
      "2026-10-05T14:30",
    );
    expect(temporalInputValue("2026-10-05T14:30", "day", BERLIN)).toBe("2026-10-05");
    expect(temporalInputValue("nope", "day")).toBeUndefined();
  });
});
