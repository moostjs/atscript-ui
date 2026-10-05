import { describe, expect, it } from "vitest";
import { coerceBoolean, coerceNumericText, isNumericText } from "./value-coerce";

describe("coerceBoolean", () => {
  it("reads true / false text case-insensitively, passes booleans, rejects the rest", () => {
    expect(coerceBoolean("true")).toBe(true);
    expect(coerceBoolean(" False ")).toBe(false);
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean("yes")).toBeUndefined();
    expect(coerceBoolean(1)).toBeUndefined();
  });
});

describe("coerceNumericText", () => {
  it("is a number for number / integer storage, a string for decimal", () => {
    expect(coerceNumericText("12.5")).toBe(12.5);
    expect(coerceNumericText("12.5", "number")).toBe(12.5);
    expect(coerceNumericText("7", "integer")).toBe(7);
    expect(coerceNumericText("12.50", "decimal")).toBe("12.50");
    expect(coerceNumericText("100", "decimal")).toBe("100");
  });

  it("rejects what is not plain decimal text, and fractions on an integer", () => {
    expect(coerceNumericText("abc")).toBeUndefined();
    expect(coerceNumericText("0x10")).toBeUndefined();
    expect(coerceNumericText("Infinity")).toBeUndefined();
    expect(coerceNumericText("")).toBeUndefined();
    expect(coerceNumericText("5.5", "integer")).toBeUndefined();
    expect(isNumericText("1e3")).toBe(true);
  });
});
