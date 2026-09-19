import { describe, it, expect } from "vitest";
import { sortRowsLocally } from "./sort-rows";

describe("sortRowsLocally", () => {
  it("returns the input reference when there is nothing to sort", () => {
    const rows = [{ a: 1 }, { a: 2 }];
    expect(sortRowsLocally(rows, [])).toBe(rows);
    expect(sortRowsLocally([{ a: 1 }], [{ field: "a", direction: "asc" }])).toHaveLength(1);
  });

  it("sorts numbers numerically in both directions without mutating the input", () => {
    const rows = [{ n: 10 }, { n: 2 }, { n: 33 }];
    expect(sortRowsLocally(rows, [{ field: "n", direction: "asc" }]).map((r) => r.n)).toEqual([
      2, 10, 33,
    ]);
    expect(sortRowsLocally(rows, [{ field: "n", direction: "desc" }]).map((r) => r.n)).toEqual([
      33, 10, 2,
    ]);
    expect(rows.map((r) => r.n)).toEqual([10, 2, 33]);
  });

  it("falls back to a locale string compare and tie-breaks on the next sorter", () => {
    const rows = [
      { a: "x", b: 2 },
      { a: "x", b: 1 },
      { a: "a", b: 9 },
    ];
    const out = sortRowsLocally(rows, [
      { field: "a", direction: "asc" },
      { field: "b", direction: "asc" },
    ]);
    expect(out.map((r) => `${r.a}${r.b}`)).toEqual(["a9", "x1", "x2"]);
  });

  it("uses the supplied value reader", () => {
    const rows = [{ o: { v: 2 } }, { o: { v: 1 } }];
    const out = sortRowsLocally(rows, [{ field: "o.v", direction: "asc" }], (row, field) =>
      field.split(".").reduce<unknown>((acc, k) => (acc as never)?.[k], row),
    );
    expect(out.map((r) => r.o.v)).toEqual([1, 2]);
  });
});
