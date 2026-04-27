import { describe, it, expect } from "vitest";
import { togglePk, trimSelection, rowsToPks } from "./selection-fns";

describe("togglePk", () => {
  it("'none' is a no-op and returns the same reference", () => {
    const selection = [1, 2];
    const next = togglePk(selection, 3, "none");
    expect(next).toBe(selection);
  });

  describe("single mode", () => {
    it("adds a new PK", () => {
      expect(togglePk([], "a", "single")).toEqual(["a"]);
    });

    it("replaces the existing PK with a different one", () => {
      expect(togglePk(["a"], "b", "single")).toEqual(["b"]);
    });

    it("toggles off when the same PK is selected", () => {
      expect(togglePk(["a"], "a", "single")).toEqual([]);
    });
  });

  describe("multi mode", () => {
    it("appends a new PK preserving insertion order", () => {
      expect(togglePk(["a", "b"], "c", "multi")).toEqual(["a", "b", "c"]);
    });

    it("removes an existing PK preserving insertion order", () => {
      expect(togglePk(["a", "b", "c"], "b", "multi")).toEqual(["a", "c"]);
    });

    it("toggles off the first PK", () => {
      expect(togglePk(["a", "b"], "a", "multi")).toEqual(["b"]);
    });

    it("toggles off the last PK", () => {
      expect(togglePk(["a", "b"], "b", "multi")).toEqual(["a"]);
    });

    it("returns a new array on append (does not mutate input)", () => {
      const selection = ["a"];
      const next = togglePk(selection, "b", "multi");
      expect(next).not.toBe(selection);
      expect(selection).toEqual(["a"]);
    });

    it("returns a new array on remove (does not mutate input)", () => {
      const selection = ["a", "b"];
      const next = togglePk(selection, "a", "multi");
      expect(next).not.toBe(selection);
      expect(selection).toEqual(["a", "b"]);
    });
  });
});

describe("trimSelection", () => {
  it("returns the same reference when every PK is present", () => {
    const selection = [1, 2, 3];
    const present = new Set([1, 2, 3, 4]);
    const next = trimSelection(selection, present);
    expect(next).toBe(selection);
  });

  it("returns a new array when one or more PKs are missing", () => {
    const selection = [1, 2, 3];
    const present = new Set([1, 3]);
    const next = trimSelection(selection, present);
    expect(next).toEqual([1, 3]);
    expect(next).not.toBe(selection);
  });

  it("empty selection short-circuits to the same reference", () => {
    const selection: unknown[] = [];
    const next = trimSelection(selection, new Set([1]));
    expect(next).toBe(selection);
  });

  it("preserves insertion order of kept PKs", () => {
    expect(trimSelection(["a", "b", "c", "d"], new Set(["b", "d"]))).toEqual(["b", "d"]);
  });
});

describe("rowsToPks", () => {
  it("maps rows to PKs via rowValueFn", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(rowsToPks(rows, (r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for empty input", () => {
    expect(rowsToPks([], (r) => r)).toEqual([]);
  });

  it("supports identity rowValueFn", () => {
    const rows = [{ x: 1 }, { x: 2 }];
    expect(rowsToPks(rows, (r) => r)).toEqual(rows);
  });
});
