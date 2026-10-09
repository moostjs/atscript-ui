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

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return typeof v === "number" || typeof v === "boolean" ? v.toString() : "";
}

function getPath(row: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((c, k) => (c as Record<string, unknown>)?.[k], row);
}

/** The original per-comparison implementation. */
function reference<T extends Record<string, unknown>>(
  rows: T[],
  sorters: { field: string; direction: "asc" | "desc" }[],
  getValue: (row: T, field: string) => unknown = (row, field) => row[field],
): T[] {
  return rows.toSorted((a, b) => {
    for (const s of sorters) {
      const dir = s.direction === "desc" ? -1 : 1;
      const av = getValue(a, s.field);
      const bv = getValue(b, s.field);
      if (typeof av === "number" && typeof bv === "number") {
        if (av < bv) return -dir;
        if (av > bv) return dir;
      } else {
        const cmp = asString(av).localeCompare(asString(bv));
        if (cmp !== 0) return cmp * dir;
      }
    }
    return 0;
  });
}

describe("sortRowsLocally equivalence", () => {
  it("orders exactly like the per-comparison sort (mixed types, ties, unicode)", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pool: unknown[] = [
      1,
      2,
      10,
      "10",
      "9",
      "a",
      "B",
      "Ärger",
      "öl",
      "Émile",
      "zulu",
      "",
      null,
      undefined,
      true,
      false,
      { o: 1 },
      2.5,
      -1,
      NaN,
    ];
    for (let round = 0; round < 40; round++) {
      const n = 2 + Math.floor(rnd() * 300);
      const rows = Array.from({ length: n }, (_, i) => ({
        id: i,
        a: pool[Math.floor(rnd() * pool.length)],
        b: pool[Math.floor(rnd() * 6)],
        nested: { c: pool[Math.floor(rnd() * pool.length)] },
      }));
      const sorters = [
        { field: round % 2 ? "b" : "a", direction: (round % 3 ? "asc" : "desc") as "asc" | "desc" },
        { field: "nested.c", direction: "desc" as const },
      ];
      expect(sortRowsLocally(rows, sorters, getPath).map((r) => r.id)).toEqual(
        reference(rows, sorters, getPath).map((r) => r.id),
      );
    }
  });
});
