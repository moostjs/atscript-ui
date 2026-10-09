import type { SortControl } from "@atscript/ui";

/**
 * Coerce a primitive cell value to the text used for comparing and matching
 * cells — the string compare in {@link sortRowsLocally} and the substring
 * search of an in-memory table. Objects and functions collapse to `""` so
 * `'[object Object]'` never drives an ordering or matches a search.
 */
export function cellAsString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return v.toString();
  return "";
}

/**
 * Sort rows in memory by `sorters`, numerically when both sides are numbers
 * and locale-aware otherwise. Returns a NEW array; the input is untouched. A
 * no-op (returns the input reference) when there is nothing to sort.
 *
 * `getValue` reads a sorter's field off a row — pass a dot-path reader for
 * nested fields; the default is a flat property read.
 */
export function sortRowsLocally<T extends Record<string, unknown>>(
  rows: T[],
  sorters: readonly SortControl[],
  getValue: (row: T, field: string) => unknown = (row, field) => row[field],
): T[] {
  if (sorters.length === 0 || rows.length < 2) return rows;
  // Read every sort key once per row (not once per comparison) and sort row
  // indexes. The comparator answers exactly what a row comparator would, and
  // the sort is the same stable one, so the order is identical.
  const n = rows.length;
  const m = sorters.length;
  const values: unknown[] = Array.from({ length: n * m });
  const texts: string[] = Array.from({ length: n * m }, () => "");
  for (let i = 0; i < n; i++) {
    const row = rows[i]!;
    for (let j = 0; j < m; j++) {
      const v = getValue(row, sorters[j]!.field);
      values[i * m + j] = v;
      texts[i * m + j] = cellAsString(v);
    }
  }
  const dirs = sorters.map((s) => (s.direction === "desc" ? -1 : 1));
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((x, y) => {
    for (let j = 0; j < m; j++) {
      const dir = dirs[j]!;
      const av = values[x * m + j];
      const bv = values[y * m + j];
      if (typeof av === "number" && typeof bv === "number") {
        if (av < bv) return -dir;
        if (av > bv) return dir;
      } else {
        const cmp = texts[x * m + j]!.localeCompare(texts[y * m + j]!);
        if (cmp !== 0) return cmp * dir;
      }
    }
    return 0;
  });
  return order.map((i) => rows[i]!);
}
