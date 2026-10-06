import { describe, expect, it } from "vitest";
import { formatColumnCondition, formatColumnValue } from "./temporal-format";
import { formatFilterExpr } from "./format-filter-expr";
import { conditionLabel } from "./filter-conditions";
import type { FilterCondition } from "./filter-types";

const ts = { type: "datetime", valueKind: "timestamp" } as const;
const day = { type: "text", valueKind: "date" } as const;
const plain = { type: "text" } as const;
const o = { locale: "en-US", timeZone: "Europe/Berlin" };
const c = (type: FilterCondition["type"], ...value: (string | number)[]) =>
  ({ type, value }) as FilterCondition;

describe("formatColumnCondition", () => {
  it("an exact shortcut shows its label", () => {
    expect(formatColumnCondition(ts, c("bw", "today-6", "today"), o)).toBe("Last 7 days");
    expect(formatColumnCondition(ts, c("eq", "month-1"), o)).toBe("Last month");
    expect(formatColumnCondition(ts, c("eq", "today"), o)).toBe("Today");
    expect(formatColumnCondition(day, c("eq", "week"), o)).toBe("This week");
  });

  it("operator word plus a date in the locale", () => {
    expect(formatColumnCondition(ts, c("eq", "2026-10-05"), o)).toBe("on Oct 5, 2026");
    expect(formatColumnCondition(ts, c("ne", "2026-10-05"), o)).toBe("not on Oct 5, 2026");
    expect(formatColumnCondition(ts, c("lt", "2026-10-05"), o)).toBe("before Oct 5, 2026");
    expect(formatColumnCondition(ts, c("lte", "2026-10-05"), o)).toBe("on or before Oct 5, 2026");
    expect(formatColumnCondition(ts, c("gte", "2026-10-05"), o)).toBe("on or after Oct 5, 2026");
    expect(formatColumnCondition(ts, c("gt", "2026-10-05T14:30"), o)).toBe(
      "after Oct 5, 2026, 14:30",
    );
    expect(formatColumnCondition(ts, c("eq", "2026-10"), o)).toBe("in Oct 2026");
  });

  it("a range in one year drops the first year", () => {
    expect(formatColumnCondition(ts, c("bw", "2026-10-01", "2026-10-05"), o)).toBe(
      "Oct 1 – Oct 5, 2026",
    );
    expect(formatColumnCondition(ts, c("bw", "2025-12-30", "2026-01-02"), o)).toBe(
      "Dec 30, 2025 – Jan 2, 2026",
    );
  });

  it("relative tokens are worded", () => {
    expect(formatColumnCondition(ts, c("eq", "today-3"), o)).toBe("3 days ago");
    expect(formatColumnCondition(ts, c("gt", "today-1"), o)).toBe("after yesterday");
    expect(formatColumnCondition(ts, c("lt", "week"), o)).toBe("before this week");
    expect(formatColumnCondition(ts, c("eq", "year-2"), o)).toBe("2 years ago");
  });

  it("an epoch number reads as a date-time in the zone", () => {
    expect(formatColumnCondition(ts, c("gte", Date.UTC(2026, 9, 5, 12, 30)), o)).toBe(
      "on or after Oct 5, 2026, 14:30",
    );
  });

  it("empty / not empty", () => {
    expect(formatColumnCondition(ts, c("null"), o)).toBe("empty");
    expect(formatColumnCondition(ts, c("notNull"), o)).toBe("not empty");
  });

  it("a non-temporal column falls back to the operator symbols", () => {
    expect(formatColumnCondition(plain, c("gt", 5), o)).toBe(">5");
    expect(formatColumnCondition(plain, c("null"), o)).toBe("<empty>");
  });
});

describe("conditionLabel by kind", () => {
  it("words date comparisons", () => {
    expect(conditionLabel("eq", "datetime")).toBe("on");
    expect(conditionLabel("lt", "date")).toBe("before");
    expect(conditionLabel("gte", "date")).toBe("on or after");
    expect(conditionLabel("bw", "datetime")).toBe("between");
    expect(conditionLabel("null", "datetime")).toBe("is empty");
    expect(conditionLabel("eq", "number")).toBe("equals");
    expect(conditionLabel("eq")).toBe("equals");
  });
});

describe("formatFilterExpr formatValue", () => {
  it("renders values through the hook", () => {
    const text = formatFilterExpr(
      {
        createdAt: { $gte: Date.UTC(2026, 9, 5, 0), $lt: Date.UTC(2026, 9, 6, 0) },
        status: "open",
      },
      (p) => p,
      (path, value) => (path === "createdAt" ? formatColumnValue(ts, value, o) : undefined),
    );
    expect(text).toContain("createdAt greater or equal Oct 5, 2026, 02:00");
    expect(text).toContain("status equals open");
  });
});

describe("chips on union columns (@ui.literalLabel)", () => {
  const column = {
    type: "enum",
    valueKind: "string" as const,
    options: [
      { key: "open", label: "Open" },
      { key: "in-progress", label: "In progress" },
    ],
  };

  it("`eq` / `ne` chips read the option label", () => {
    expect(formatColumnCondition(column, { type: "eq", value: ["in-progress"] })).toBe(
      "In progress",
    );
    expect(formatColumnCondition(column, { type: "ne", value: ["open"] })).toBe("!=Open");
  });

  it("pattern operators keep the typed text; unknown literals stay raw", () => {
    expect(formatColumnCondition(column, { type: "contains", value: ["in-"] })).toBe("*in-*");
    expect(formatColumnCondition(column, { type: "eq", value: ["archived"] })).toBe("archived");
  });

  it("formatColumnValue labels a single value for residual-filter display", () => {
    expect(formatColumnValue(column, "open")).toBe("Open");
    expect(formatColumnValue(column, "zzz")).toBeUndefined();
  });
});
