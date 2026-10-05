import { afterEach, describe, expect, it, vi } from "vitest";
import { getDateTimeFormat, getZoneFormat } from "./intl-cache";

afterEach(() => vi.restoreAllMocks());

describe("getDateTimeFormat", () => {
  it("returns the same formatter for the same locale and options, whatever their key order", () => {
    const a = getDateTimeFormat("en-US", { year: "numeric", month: "short" });
    expect(getDateTimeFormat("en-US", { month: "short", year: "numeric" })).toBe(a);
    expect(getDateTimeFormat("de-DE", { year: "numeric", month: "short" })).not.toBe(a);
  });

  it("keeps formatters apart by every option that changes the output", () => {
    const base = { hour: "2-digit", minute: "2-digit" } as const;
    const h23 = getDateTimeFormat("en-US", { ...base, hourCycle: "h23" });
    const h12 = getDateTimeFormat("en-US", { ...base, hourCycle: "h12" });
    expect(h23).not.toBe(h12);
    expect(getDateTimeFormat("en-US", { month: "short" })).not.toBe(
      getDateTimeFormat("en-US", { month: "long" }),
    );
  });

  it("an unknown zone reads on the local clock and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = getDateTimeFormat("en-US", { timeZone: "Mars/Olympus", year: "numeric" });
    expect(f.format(new Date(0))).toMatch(/19(69|70)/);
    getDateTimeFormat("en-US", { timeZone: "Mars/Olympus", year: "numeric" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getZoneFormat", () => {
  it("is a formatter for a known zone and null for an unknown one", () => {
    expect(getZoneFormat("Europe/Berlin")).toBe(getZoneFormat("Europe/Berlin"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getZoneFormat("Mars/Olympus")).toBeNull();
  });
});
