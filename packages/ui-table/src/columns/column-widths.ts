import type { ColumnDef } from "@atscript/ui";

/** Per-column width entry: `w` is the rendered width, `d` is the default. */
export interface ColumnWidthEntry {
  w: string;
  d: string;
}

/** Map keyed by `ColumnDef.path`. Always fully populated for every column. */
export type ColumnWidthsMap = Record<string, ColumnWidthEntry>;

/** Upper bound applied only to default-width computation. Annotation widths and manual resize are not capped. */
export const MAX_DEFAULT_COLUMN_WIDTH_PX = 320;

/**
 * Computes a sane default width for a column from its type + length annotation.
 *
 * Resolution order:
 *   1. col.width (@ui.field.width or @ui.table.column.width annotation) wins outright.
 *   2. Otherwise pick from a type-based table; for `text` columns with `maxLen`,
 *      derive from char-count using a SAPUI5-style 8px-per-char heuristic.
 *   3. Cap the result at MAX_DEFAULT_COLUMN_WIDTH_PX (does not apply to step 1).
 */
export function computeDefaultColumnWidth(col: ColumnDef): string {
  if (col.width) return col.width;
  return `${capDefault(rawDefaultPx(col))}px`;
}

function rawDefaultPx(col: ColumnDef): number {
  switch (col.type) {
    case "boolean":
      return 64;
    case "number":
      return 96;
    case "ref":
      return 200;
    case "array":
    case "object":
      return 240;
    case "enum": {
      if (col.options?.length) {
        let longest = 0;
        for (const opt of col.options) {
          if (opt.label.length > longest) longest = opt.label.length;
        }
        return Math.max(96, longest * 8 + 48);
      }
      return 160;
    }
    case "text": {
      if (col.maxLen && col.maxLen > 0) {
        return Math.max(96, col.maxLen * 8 + 32);
      }
      return 200;
    }
    default:
      return 160;
  }
}

function capDefault(px: number): number {
  if (px < 64) return 64;
  if (px > MAX_DEFAULT_COLUMN_WIDTH_PX) return MAX_DEFAULT_COLUMN_WIDTH_PX;
  return px;
}

/**
 * Reconciles a current ColumnWidthsMap against the latest column list:
 *   - new columns get a fresh `{ w: d, d }` entry where `d = computeDefaultColumnWidth(col)`
 *   - existing columns keep `w` (preserves manual resize) but refresh `d`
 *   - paths no longer present are kept (preserves user widths if columns reappear)
 *
 * Returns a NEW map only when something actually changed; otherwise returns `current`
 * so a shallowRef writer can short-circuit.
 */
export function reconcileColumnWidthDefaults(
  allColumns: ColumnDef[],
  current: ColumnWidthsMap,
): ColumnWidthsMap {
  let next: ColumnWidthsMap = current;
  for (const col of allColumns) {
    const d = computeDefaultColumnWidth(col);
    const existing = current[col.path];
    if (!existing) {
      if (next === current) next = { ...current };
      next[col.path] = { w: d, d };
    } else if (existing.d !== d) {
      if (next === current) next = { ...current };
      next[col.path] = { w: existing.w, d };
    }
  }
  return next;
}
