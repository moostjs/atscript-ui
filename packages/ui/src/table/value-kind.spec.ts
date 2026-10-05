import { describe, expect, it } from "vitest";
import { NUMERIC_VALUE_KINDS, optionValue } from "./value-kind";

describe("optionValue", () => {
  it("is the typed literal, falling back to the key for a hand-built option", () => {
    expect(optionValue({ key: "true", label: "true", value: true })).toBe(true);
    expect(optionValue({ key: "3", label: "3", value: 3 })).toBe(3);
    expect(optionValue({ key: "a", label: "A" })).toBe("a");
    // a falsy literal is still the literal
    expect(optionValue({ key: "0", label: "0", value: 0 })).toBe(0);
    expect(optionValue({ key: "false", label: "false", value: false })).toBe(false);
  });
});

describe("NUMERIC_VALUE_KINDS", () => {
  it("holds the plain number kinds", () => {
    expect([...NUMERIC_VALUE_KINDS].toSorted()).toEqual(["decimal", "integer", "number"]);
  });
});
