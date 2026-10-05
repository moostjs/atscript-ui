import { describe, it, expect } from "vitest";
import {
  togglePk,
  trimSelection,
  rowsToPks,
  selectionQueryOf,
  selectionSignature,
  stableValueKey,
} from "./selection-fns";

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

describe("selectionSignature", () => {
  it("is insensitive to object key order at every depth", () => {
    const a = selectionSignature({ filter: { status: "open", $or: [{ a: 1, b: 2 }] } });
    const b = selectionSignature({ filter: { $or: [{ b: 2, a: 1 }], status: "open" } });
    expect(a).toBe(b);
  });

  it("treats an empty filter, empty search and absent parts alike", () => {
    expect(selectionSignature({ filter: {}, search: "" })).toBe(selectionSignature({}));
  });

  it("changes with the filter, the search term and the index", () => {
    const base = selectionSignature({ filter: { status: "open" }, search: "x" });
    expect(selectionSignature({ filter: { status: "done" }, search: "x" })).not.toBe(base);
    expect(selectionSignature({ filter: { status: "open" }, search: "y" })).not.toBe(base);
    expect(selectionSignature({ filter: { status: "open" }, search: "x", index: "idx" })).not.toBe(
      base,
    );
  });

  it("keeps different regular expressions and dates apart", () => {
    expect(selectionSignature({ filter: { name: { $regex: /a/i } as never } })).not.toBe(
      selectionSignature({ filter: { name: { $regex: /b/i } as never } }),
    );
    expect(selectionSignature({ filter: { at: new Date(0) as never } })).not.toBe(
      selectionSignature({ filter: { at: new Date(1) as never } }),
    );
  });
});

const idOf = (v: unknown) => (v as { id: number }).id;

describe("togglePk with keyOf (query-selection exclusions)", () => {
  it("appends an absent pk and removes a present one", () => {
    expect(togglePk([1], 2, "multi")).toEqual([1, 2]);
    expect(togglePk([1, 2], 1, "multi")).toEqual([2]);
  });

  it("compares by `keyOf` when given", () => {
    expect(togglePk([{ id: 1 }], { id: 1 }, "multi", idOf)).toEqual([]);
    expect(togglePk([{ id: 1 }], { id: 2 }, "multi", idOf)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("never mutates the input", () => {
    const excluded = [1];
    togglePk(excluded, 2, "multi");
    togglePk(excluded, 1, "multi");
    expect(excluded).toEqual([1]);
  });
});

describe("selectionQueryOf", () => {
  it("keeps the filter and the search term, drops sort / select / paging", () => {
    expect(
      selectionQueryOf({
        filter: { status: "open" },
        controls: { $search: "abc", $sort: { id: 1 }, $select: ["id"], $limit: 10 },
      } as never),
    ).toEqual({ filter: { status: "open" }, search: "abc" });
  });

  it("reads the index from a `$search:<index>` key", () => {
    expect(selectionQueryOf({ controls: { "$search:by_title": "abc" } } as never)).toEqual({
      search: "abc",
      index: "by_title",
    });
  });

  it("leaves out an empty filter and an empty term", () => {
    expect(selectionQueryOf({ filter: {}, controls: { $search: "" } } as never)).toEqual({});
  });
});

describe("stableValueKey", () => {
  it("ignores key order at every depth and spells out RegExp / Date", () => {
    expect(stableValueKey({ b: 1, a: { d: 1, c: [{ y: 1, x: 2 }] } })).toBe(
      stableValueKey({ a: { c: [{ x: 2, y: 1 }], d: 1 }, b: 1 }),
    );
    expect(stableValueKey({ a: /x/i })).not.toBe(stableValueKey({ a: /y/i }));
    expect(stableValueKey({ a: new Date(0) })).not.toBe(stableValueKey({ a: new Date(1) }));
    expect(stableValueKey(null)).toBe("null");
  });
});
