import { arrangeText, getByPath, optionLabel, str, type ColumnDef } from "@atscript/ui";
import type { ExportScalar } from "./csv";

/**
 * Turn a raw cell value into the scalar an export carries, using the same
 * column metadata the cell renderers read:
 *
 * - `null` / `undefined` → `null` (an empty CSV field).
 * - union / enum and boolean columns (`column.options`) → the option's
 *   **label** (`Yes` / `No` for an unlabelled boolean), so the file reads like
 *   the screen; an unknown key falls back to the raw value.
 * - `Date` → ISO 8601 (spreadsheet- and re-import-friendly, unlike a
 *   locale-formatted date).
 * - arrays → comma-joined scalars; other objects → JSON.
 * - a `@ui.valueLabel` column (`column.valueLabel`, given the `row`) → the
 *   code with the row's text, as the cell shows it (since 0.1.190).
 * - numbers (and booleans of a column without `options`) pass through
 *   untouched so a spreadsheet keeps them numeric.
 *
 * Callers override per column (`formatters`) or globally (`formatCell`) when
 * they want different text.
 */
export function resolveExportValue(
  value: unknown,
  column?: ColumnDef,
  row?: Record<string, unknown>,
): ExportScalar {
  if (value === null || value === undefined) return null;

  const label = column && optionLabel(column, value);
  if (label !== undefined) return label;

  const valueLabel = column?.valueLabel;
  if (valueLabel && row && (typeof value === "string" || typeof value === "number")) {
    const text = getByPath({ value: row }, valueLabel.path);
    return arrangeText(String(value), text, valueLabel.arrangement);
  }

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    // an array of a union (`tags: Tag[]`): each element shows its option label
    return value.map((v) => (column && optionLabel(column, v)) || scalarText(v)).join(", ");
  }
  return scalarText(value);
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined || typeof value === "function") return "";
  // `str` JSON-encodes anything that isn't a primitive, and a circular
  // structure throws there — an unrepresentable cell exports as empty rather
  // than as `[object Object]`.
  try {
    return str(value);
  } catch {
    return "";
  }
}
