import { describe, expect, it } from "vitest";
import { formatIndexedLabel } from "../composables/use-form-context";

describe("formatIndexedLabel", () => {
  it("returns label unchanged when arrayIndex is undefined", () => {
    expect(formatIndexedLabel("Name", undefined)).toBe("Name");
  });

  it("prepends #1 to label when arrayIndex is 0", () => {
    expect(formatIndexedLabel("Item", 0)).toBe("Item #1");
  });

  it("prepends #3 to label when arrayIndex is 2", () => {
    expect(formatIndexedLabel("Entry", 2)).toBe("Entry #3");
  });

  it("returns just #1 when label is undefined and arrayIndex is 0", () => {
    expect(formatIndexedLabel(undefined, 0)).toBe("#1");
  });

  it("returns undefined when both label and arrayIndex are undefined", () => {
    expect(formatIndexedLabel(undefined, undefined)).toBeUndefined();
  });
});
