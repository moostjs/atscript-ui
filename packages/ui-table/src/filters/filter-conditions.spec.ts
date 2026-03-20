import { describe, expect, it } from "vitest";
import { conditionLabel, hasSecondValue, isFilled } from "./filter-conditions";

describe("isFilled", () => {
  it("returns true for null/notNull regardless of value", () => {
    expect(isFilled({ type: "null", value: [] })).toBe(true);
    expect(isFilled({ type: "notNull", value: [] })).toBe(true);
  });

  it("returns true for eq with a non-empty value", () => {
    expect(isFilled({ type: "eq", value: ["active"] })).toBe(true);
    expect(isFilled({ type: "eq", value: [42] })).toBe(true);
    expect(isFilled({ type: "eq", value: [false] })).toBe(true);
  });

  it("returns false for eq with empty value", () => {
    expect(isFilled({ type: "eq", value: [] })).toBe(false);
    expect(isFilled({ type: "eq", value: [""] })).toBe(false);
  });

  it("returns true for bw with two values", () => {
    expect(isFilled({ type: "bw", value: [10, 100] })).toBe(true);
    expect(isFilled({ type: "bw", value: ["2024-01-01", "2024-12-31"] })).toBe(true);
  });

  it("returns false for bw with missing values", () => {
    expect(isFilled({ type: "bw", value: [10] })).toBe(false);
    expect(isFilled({ type: "bw", value: ["", "100"] })).toBe(false);
    expect(isFilled({ type: "bw", value: ["10", ""] })).toBe(false);
  });

  it("returns true for in/nin with at least one non-empty value", () => {
    expect(isFilled({ type: "in", value: ["a", "b"] })).toBe(true);
    expect(isFilled({ type: "nin", value: [1] })).toBe(true);
  });

  it("returns false for in/nin with no meaningful values", () => {
    expect(isFilled({ type: "in", value: [] })).toBe(false);
    expect(isFilled({ type: "nin", value: [""] })).toBe(false);
  });

  it("returns true for comparison conditions with a value", () => {
    expect(isFilled({ type: "gt", value: [5] })).toBe(true);
    expect(isFilled({ type: "contains", value: ["test"] })).toBe(true);
    expect(isFilled({ type: "regex", value: ["^[A-Z]"] })).toBe(true);
  });

  it("returns false for comparison conditions without a value", () => {
    expect(isFilled({ type: "gt", value: [] })).toBe(false);
    expect(isFilled({ type: "contains", value: [""] })).toBe(false);
  });

  it("returns true for eq with value 0", () => {
    expect(isFilled({ type: "eq", value: [0] })).toBe(true);
  });
});

describe("hasSecondValue", () => {
  it("returns true only for bw", () => {
    expect(hasSecondValue("bw")).toBe(true);
  });

  it("returns false for all other types", () => {
    expect(hasSecondValue("eq")).toBe(false);
    expect(hasSecondValue("ne")).toBe(false);
    expect(hasSecondValue("gt")).toBe(false);
    expect(hasSecondValue("in")).toBe(false);
    expect(hasSecondValue("null")).toBe(false);
    expect(hasSecondValue("contains")).toBe(false);
  });
});

describe("conditionLabel", () => {
  it("returns human-readable labels", () => {
    expect(conditionLabel("eq")).toBe("equals");
    expect(conditionLabel("ne")).toBe("not equals");
    expect(conditionLabel("gt")).toBe("greater than");
    expect(conditionLabel("gte")).toBe("greater or equal");
    expect(conditionLabel("lt")).toBe("less than");
    expect(conditionLabel("lte")).toBe("less or equal");
    expect(conditionLabel("contains")).toBe("contains");
    expect(conditionLabel("starts")).toBe("starts with");
    expect(conditionLabel("ends")).toBe("ends with");
    expect(conditionLabel("bw")).toBe("between");
    expect(conditionLabel("in")).toBe("in set");
    expect(conditionLabel("nin")).toBe("not in set");
    expect(conditionLabel("null")).toBe("is empty");
    expect(conditionLabel("notNull")).toBe("is not empty");
    expect(conditionLabel("regex")).toBe("matches pattern");
  });
});
