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
  return rows.toSorted((a, b) => {
    for (const s of sorters) {
      const dir = s.direction === "desc" ? -1 : 1;
      const av = getValue(a, s.field);
      const bv = getValue(b, s.field);
      if (typeof av === "number" && typeof bv === "number") {
        if (av < bv) return -dir;
        if (av > bv) return dir;
      } else {
        const cmp = cellAsString(av).localeCompare(cellAsString(bv));
        if (cmp !== 0) return cmp * dir;
      }
    }
    return 0;
  });
}
