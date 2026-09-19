import { str, type ColumnDef } from "@atscript/ui";
import type { ExportScalar } from "./csv";

/**
 * Turn a raw cell value into the scalar an export carries, using the same
 * column metadata the cell renderers read:
 *
 * - `null` / `undefined` → `null` (an empty CSV field).
 * - union / enum columns (`column.options`) → the option's **label**, so the
 *   file reads like the screen; an unknown key falls back to the raw value.
 * - `Date` → ISO 8601 (spreadsheet- and re-import-friendly, unlike a
 *   locale-formatted date).
 * - arrays → comma-joined scalars; other objects → JSON.
 * - numbers / booleans pass through untouched so a spreadsheet keeps them
 *   numeric.
 *
 * Callers override per column (`formatters`) or globally (`formatCell`) when
 * they want different text.
 */
export function resolveExportValue(value: unknown, column?: ColumnDef): ExportScalar {
  if (value === null || value === undefined) return null;

  const options = column?.options;
  if (options?.length) {
    const key = typeof value === "string" || typeof value === "number" ? String(value) : undefined;
    if (key !== undefined) {
      const hit = options.find((o) => o.key === key);
      if (hit) return hit.label;
    }
  }

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => scalarText(v)).join(", ");
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
