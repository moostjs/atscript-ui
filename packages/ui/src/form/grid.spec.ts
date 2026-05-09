import { describe, expect, it } from "vitest";
import {
  DEFAULT_COL_SPAN,
  DEFAULT_ROW_SPAN,
  parseColSpan,
  parseRowSpan,
  resolveGridSpec,
} from "./grid";

describe("parseColSpan", () => {
  it("accepts numeric strings 1-12", () => {
    for (let i = 1; i <= 12; i++) expect(parseColSpan(String(i))).toBe(i);
  });
  it("accepts the named aliases", () => {
    expect(parseColSpan("full")).toBe(12);
    expect(parseColSpan("half")).toBe(6);
    expect(parseColSpan("third")).toBe(4);
  });
  it.each(["", "0", "13", "100", "abc", "-1", "1.5", "ten", "fourth"])(
    "rejects %p",
    (raw) => {
      expect(parseColSpan(raw)).toBeUndefined();
    },
  );
  it("returns undefined for undefined input", () => {
    expect(parseColSpan(undefined)).toBeUndefined();
  });
});

describe("parseRowSpan", () => {
  it("accepts positive numeric strings", () => {
    expect(parseRowSpan("1")).toBe(1);
    expect(parseRowSpan("2")).toBe(2);
    expect(parseRowSpan("99")).toBe(99);
  });
  it.each(["", "0", "-1", "1.5", "abc", "full"])("rejects %p", (raw) => {
    expect(parseRowSpan(raw)).toBeUndefined();
  });
});

describe("resolveGridSpec", () => {
  it("defaults to full-width / single-row when no annotations", () => {
    expect(resolveGridSpec(undefined, undefined)).toEqual({
      col: { desktop: DEFAULT_COL_SPAN, narrow: DEFAULT_COL_SPAN },
      row: { desktop: DEFAULT_ROW_SPAN, narrow: DEFAULT_ROW_SPAN },
    });
  });
  it("uses single-arg colSpan with default narrow=full", () => {
    expect(resolveGridSpec({ desktop: "6" }, undefined)).toEqual({
      col: { desktop: 6, narrow: 12 },
      row: { desktop: 1, narrow: 1 },
    });
  });
  it("respects two-arg colSpan", () => {
    expect(resolveGridSpec({ desktop: "6", narrow: "8" }, undefined)).toEqual({
      col: { desktop: 6, narrow: 8 },
      row: { desktop: 1, narrow: 1 },
    });
  });
  it("resolves aliases", () => {
    expect(resolveGridSpec({ desktop: "half", narrow: "full" }, undefined)).toEqual({
      col: { desktop: 6, narrow: 12 },
      row: { desktop: 1, narrow: 1 },
    });
  });
  it("falls back to defaults on invalid args", () => {
    expect(resolveGridSpec({ desktop: "bogus" }, { desktop: "bogus" })).toEqual({
      col: { desktop: DEFAULT_COL_SPAN, narrow: DEFAULT_COL_SPAN },
      row: { desktop: DEFAULT_ROW_SPAN, narrow: DEFAULT_ROW_SPAN },
    });
  });
  it("respects rowSpan two-arg form", () => {
    expect(resolveGridSpec(undefined, { desktop: "2", narrow: "1" })).toEqual({
      col: { desktop: 12, narrow: 12 },
      row: { desktop: 2, narrow: 1 },
    });
  });
});
