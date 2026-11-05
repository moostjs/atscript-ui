import { afterEach, describe, expect, it } from "vitest";
import { setUiLocale, type UiT } from "@atscript/ui";
import { conditionLabel, filterTokenLabel } from "./filter-conditions";
import { formatFilterExpr } from "./format-filter-expr";
import { formatColumnCondition, formatColumnValue } from "./temporal-format";
import { temporalShortcuts } from "./temporal";
import { dateShortcuts } from "./date-shortcuts";
import { resolveSystemPresets } from "../presets/system-presets";

/** A `t` that shows which code (and params) a wording reads. */
const codes: UiT = (id, params) => (params ? `${id}${JSON.stringify(params)}` : id);

/** A `t` that shows the code with its param values. */
const withParams: UiT = (id, p) => (p ? `${id}(${Object.values(p).map(String).join(",")})` : id);
/** A `t` with a few words, for nested wording. */
const nested: UiT = (id, p) =>
  ({ UI_FILTER_OR: "oder", UI_FILTER_CHIP_ANY: "alle" })[id] ??
  (id === "UI_FILTER_CHIP_SOME" ? `${String(p?.field)} hat (${String(p?.filter)})` : id);

const date = { type: "date", valueKind: "isoDate" } as const;

afterEach(() => setUiLocale(undefined));

describe("filter wording reads UI texts", () => {
  it("condition names, per column kind", () => {
    expect(conditionLabel("eq", undefined, codes)).toBe("UI_FILTER_COND_EQ");
    expect(conditionLabel("eq", "date", codes)).toBe("UI_FILTER_DATE_EQ");
    expect(conditionLabel("bw", "datetime", codes)).toBe("UI_FILTER_COND_BW");
    expect(conditionLabel("contains", "date", codes)).toBe("UI_FILTER_COND_CONTAINS");
  });

  it("chip tokens", () => {
    expect(filterTokenLabel("a", [{ type: "null", value: [] }], "A", codes)).toBe(
      'UI_FILTER_CHIP_EMPTY{"field":"A"}',
    );
    expect(filterTokenLabel("a", [{ type: "eq", value: [1] }], "A", codes)).toBe(
      'UI_FILTER_CHIP{"field":"A","condition":"UI_FILTER_COND_EQ","value":1}',
    );
  });

  it("filter expressions, nested ones included", () => {
    expect(
      formatFilterExpr(
        { $or: [{ a: { $some: {} } }, { b: { $some: {} } }] },
        undefined,
        undefined,
        nested,
      ),
    ).toBe("a hat (alle) oder b hat (alle)");
  });

  it("date chips: shortcuts, relative tokens, comparisons", () => {
    expect(
      formatColumnCondition(date, { type: "bw", value: ["today-6", "today"] }, { t: withParams }),
    ).toBe("UI_DATE_LAST_7_DAYS");
    expect(formatColumnCondition(date, { type: "eq", value: ["week-3"] }, { t: withParams })).toBe(
      "UI_FILTER_WEEKS_AGO(3)",
    );
    expect(formatColumnCondition(date, { type: "lt", value: ["today-1"] }, { t: withParams })).toBe(
      "UI_FILTER_BEFORE_DATE(UI_FILTER_YESTERDAY(1))",
    );
    expect(formatColumnCondition(date, { type: "null", value: [] }, { t: withParams })).toBe(
      "UI_FILTER_EMPTY",
    );
    expect(formatColumnValue(date, "year", { t: withParams })).toBe("UI_FILTER_THIS_YEAR(0)");
  });

  it("shortcut and preset labels; the active UI locale by default", () => {
    expect(temporalShortcuts(codes).map((s) => s.label)[0]).toBe("UI_DATE_TODAY");
    setUiLocale(
      "de",
      (id) =>
        ({
          UI_DATE_TODAY: "Heute",
          UI_PRESET_STANDARD: "Standard (de)",
          UI_DATES_YEAR_TO_DATE: "YTD",
        })[id],
    );
    expect(temporalShortcuts()[0].label).toBe("Heute");
    expect(resolveSystemPresets()[0].label).toBe("Standard (de)");
    expect(resolveSystemPresets(undefined, codes)[0].label).toBe("UI_PRESET_STANDARD");
    expect(dateShortcuts(new Date(2026, 0, 15)).at(-1)!.label).toBe("YTD");
    expect(formatColumnCondition(date, { type: "eq", value: ["today"] })).toBe("Heute");
  });
});
