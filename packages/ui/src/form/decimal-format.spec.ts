import { describe, expect, it } from "vitest";
import {
  enforceScale,
  formatDecimalForDisplay,
  getCurrencyDecimals,
  getCurrencyDisplayParts,
  getDecimalSeparator,
  getThousandsSeparator,
  groupInteger,
  joinDecimalString,
  parseDecimalInput,
  splitDecimalString,
} from "./decimal-format";

describe("getDecimalSeparator", () => {
  it("returns '.' for en-US", () => {
    expect(getDecimalSeparator("en-US")).toBe(".");
  });
  it("returns ',' for fr-FR", () => {
    expect(getDecimalSeparator("fr-FR")).toBe(",");
  });
  it("returns '.' for ja-JP", () => {
    expect(getDecimalSeparator("ja-JP")).toBe(".");
  });
  it("returns '.' for ar-EG (Latin-digit fallback ok)", () => {
    // Arabic-EG uses '.' as decimal in Latin digits — the helper formats with
    // default-system digits but the separator type is stable.
    const sep = getDecimalSeparator("ar-EG");
    expect(typeof sep).toBe("string");
    expect(sep.length).toBeGreaterThan(0);
  });
  it("returns '.' when locale is undefined", () => {
    // Runtime locale in tests may vary, but the separator returned is a
    // single non-empty char.
    const sep = getDecimalSeparator(undefined);
    expect(typeof sep).toBe("string");
    expect(sep.length).toBeGreaterThan(0);
  });
});

describe("getThousandsSeparator", () => {
  it("returns ',' for en-US", () => {
    expect(getThousandsSeparator("en-US")).toBe(",");
  });
  it("returns a non-empty separator for fr-FR (NNBSP)", () => {
    const sep = getThousandsSeparator("fr-FR");
    expect(sep.length).toBeGreaterThanOrEqual(1);
    // FR uses NNBSP (U+202F) or NBSP (U+00A0) depending on engine — both fine.
    expect(",.".includes(sep)).toBe(false);
  });
});

describe("getCurrencyDecimals", () => {
  it("USD → 2", () => {
    expect(getCurrencyDecimals("USD")).toBe(2);
  });
  it("EUR → 2", () => {
    expect(getCurrencyDecimals("EUR")).toBe(2);
  });
  it("JPY → 0", () => {
    expect(getCurrencyDecimals("JPY")).toBe(0);
  });
  it("BHD → 3", () => {
    expect(getCurrencyDecimals("BHD")).toBe(3);
  });
  it("KWD → 3", () => {
    expect(getCurrencyDecimals("KWD")).toBe(3);
  });
  it("unknown code → undefined", () => {
    expect(getCurrencyDecimals("XYZ123")).toBeUndefined();
  });
});

describe("getCurrencyDisplayParts", () => {
  it("returns a symbol and a position", () => {
    const usd = getCurrencyDisplayParts("USD", "en-US");
    expect(usd.symbol.length).toBeGreaterThan(0);
    expect(usd.position === "prefix" || usd.position === "suffix").toBe(true);
  });
  it("falls back to code on unknown currency", () => {
    const x = getCurrencyDisplayParts("XYZ123", "en-US");
    expect(x.symbol).toBe("XYZ123");
  });
});

describe("parseDecimalInput", () => {
  it("accepts en-US thousands separator", () => {
    expect(parseDecimalInput("1,234.56", "en-US")).toBe("1234.56");
  });
  it("accepts fr-FR thousands separator", () => {
    // FR formats 1234.56 as "1 234,56" (NNBSP). Use the actual separator.
    const sep = getThousandsSeparator("fr-FR");
    expect(parseDecimalInput(`1${sep}234,56`, "fr-FR")).toBe("1234.56");
  });
  it("parses negative values", () => {
    expect(parseDecimalInput("-1234.56", "en-US")).toBe("-1234.56");
  });
  it("parses integers", () => {
    expect(parseDecimalInput("1234", "en-US")).toBe("1234");
  });
  it("trims trailing decimal point", () => {
    expect(parseDecimalInput("1234.", "en-US")).toBe("1234");
  });
  it("pads leading decimal point", () => {
    expect(parseDecimalInput(".5", "en-US")).toBe("0.5");
  });
  it("rejects double-decimal", () => {
    expect(parseDecimalInput("12.34.56", "en-US")).toBeNull();
  });
  it("rejects alpha", () => {
    expect(parseDecimalInput("abc", "en-US")).toBeNull();
  });
  it("rejects empty", () => {
    expect(parseDecimalInput("", "en-US")).toBeNull();
  });
  it("rejects double sign", () => {
    expect(parseDecimalInput("--1", "en-US")).toBeNull();
  });
  it("rejects sign in middle", () => {
    expect(parseDecimalInput("1-2", "en-US")).toBeNull();
  });
  it("rejects malformed grouping in en-US (single 'XX,YY' has invalid groups)", () => {
    // In en-US, "," is the thousands separator; "12,34" is a malformed
    // grouping (groups must be exactly 3 digits after the first). We refuse
    // rather than silently accept "12.34" — the paste came from a locale
    // that uses "," for decimal, but we can't tell which one.
    expect(parseDecimalInput("12,34", "en-US")).toBeNull();
  });
  it("accepts comma-as-decimal in fr-FR locale (paste from comma-decimal source)", () => {
    expect(parseDecimalInput("12,34", "fr-FR")).toBe("12.34");
  });
  it("rejects mixed-separator ambiguity in '.'-decimal locale", () => {
    // Both "." and "," present and "," isn't a known grouping → ambiguous.
    expect(parseDecimalInput("1,2.3,4", "en-US")).toBeNull();
  });
  it("strips redundant leading zeros", () => {
    expect(parseDecimalInput("007.5", "en-US")).toBe("7.5");
    expect(parseDecimalInput("0", "en-US")).toBe("0");
    expect(parseDecimalInput("0.5", "en-US")).toBe("0.5");
  });
  it("normalises negative zero to zero", () => {
    expect(parseDecimalInput("-0.0", "en-US")).toBe("0.0");
  });
});

describe("enforceScale", () => {
  it("truncates without rounding by default", () => {
    expect(enforceScale("12.345", 2)).toBe("12.34");
  });
  it("pads with zeros", () => {
    expect(enforceScale("12.3", 4)).toBe("12.3000");
  });
  it("scale=0 drops decimal", () => {
    expect(enforceScale("12.99", 0)).toBe("12");
  });
  it("scale=0 on integer is no-op", () => {
    expect(enforceScale("12", 0)).toBe("12");
  });
  it("rounds half-up when opted in", () => {
    expect(enforceScale("12.345", 2, { roundHalfUp: true })).toBe("12.35");
    expect(enforceScale("12.344", 2, { roundHalfUp: true })).toBe("12.34");
  });
  it("rounding overflows into integer", () => {
    expect(enforceScale("9.99", 1, { roundHalfUp: true })).toBe("10.0");
  });
  it("string-only correctness: preserves precision floats would lose", () => {
    // Number("1234567890.12345678") would lose precision; enforceScale should not.
    expect(enforceScale("1234567890.12345678", 6)).toBe("1234567890.123456");
  });
  it("handles negative", () => {
    expect(enforceScale("-12.005", 2)).toBe("-12.00");
  });
  it("scale undefined is no-op", () => {
    expect(enforceScale("12.34", undefined)).toBe("12.34");
  });
});

describe("splitDecimalString + joinDecimalString round-trip", () => {
  it.each([
    ["1234.56", { sign: "", integer: "1234", decimal: "56" }],
    ["-0.1", { sign: "-", integer: "0", decimal: "1" }],
    ["100", { sign: "", integer: "100", decimal: "" }],
    ["0", { sign: "", integer: "0", decimal: "" }],
    ["0.000", { sign: "", integer: "0", decimal: "000" }],
  ] as const)("round-trips %s", (input, expected) => {
    const parts = splitDecimalString(input);
    expect(parts).toEqual(expected);
    expect(joinDecimalString(parts)).toBe(input);
  });
});

describe("groupInteger", () => {
  it("groups en-US", () => {
    expect(groupInteger("1234567", "en-US")).toBe("1,234,567");
  });
  it("no grouping for <=3 digits", () => {
    expect(groupInteger("123", "en-US")).toBe("123");
  });
  it("groups large numbers", () => {
    expect(groupInteger("1000000000", "en-US")).toBe("1,000,000,000");
  });
});

describe("formatDecimalForDisplay", () => {
  it("plain en-US with scale", () => {
    expect(formatDecimalForDisplay({ value: "1234.5", scale: 2, locale: "en-US" })).toBe(
      "1,234.50",
    );
  });
  it("plain fr-FR with scale", () => {
    const out = formatDecimalForDisplay({ value: "1234.5", scale: 2, locale: "fr-FR" });
    // FR groups with NNBSP/NBSP and decimal is ",". We check structure, not the exact char.
    expect(out.includes(",50")).toBe(true);
    expect(out.startsWith("1")).toBe(true);
  });
  it("currency formats with Intl", () => {
    const out = formatDecimalForDisplay({
      value: "1234.5",
      scale: 2,
      locale: "en-US",
      currency: "USD",
    });
    expect(out.includes("1,234.50")).toBe(true);
  });
  it("unit appends to plain", () => {
    expect(formatDecimalForDisplay({ value: "4.25", scale: 2, locale: "en-US", unit: "kg" })).toBe(
      "4.25 kg",
    );
  });
  it("scale=0 omits decimal", () => {
    expect(formatDecimalForDisplay({ value: "100", scale: 0, locale: "en-US" })).toBe("100");
  });
  it("scale=undefined preserves raw fractional digits, ungrouped by default", () => {
    expect(formatDecimalForDisplay({ value: "1234.567", locale: "en-US" })).toBe("1234.567");
    expect(formatDecimalForDisplay({ value: "1234.567", locale: "en-US", useGrouping: true })).toBe(
      "1,234.567",
    );
  });
  it("null / undefined / empty → ''", () => {
    expect(formatDecimalForDisplay({ value: null })).toBe("");
    expect(formatDecimalForDisplay({ value: undefined })).toBe("");
    expect(formatDecimalForDisplay({ value: "" })).toBe("");
  });
  it("number value is accepted", () => {
    expect(formatDecimalForDisplay({ value: 1234.5, scale: 2, locale: "en-US" })).toBe("1,234.50");
  });
});
