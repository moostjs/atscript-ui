import type { ColumnDef } from "@atscript/ui";
import { formatCellValue } from "./format-cell";
import { getCellValue } from "./get-cell-value";

type ColumnOptions = NonNullable<ColumnDef["options"]>;

/** Option key → label, built once per options list (first match wins, as `find` would). */
const labelsByOptions = new WeakMap<ColumnOptions, Map<string, string>>();

function optionLabels(options: ColumnOptions): Map<string, string> {
  let labels = labelsByOptions.get(options);
  if (!labels) {
    labels = new Map();
    for (const o of options) if (!labels.has(o.key)) labels.set(o.key, o.label);
    labelsByOptions.set(options, labels);
  }
  return labels;
}

/**
 * The text the built-in default cell (`AsTableCellValue`) shows: a union
 * column shows the option label (`@ui.literalLabel`); anything else formats
 * by type.
 */
export function displayCellValue(row: Record<string, unknown>, column: ColumnDef): string {
  const value = getCellValue(row, column.path);
  const options = column.options;
  if (options?.length && value !== null && typeof value !== "object") {
    const labels = optionLabels(options);
    const key = String(value as string | number | boolean | bigint | symbol | undefined);
    if (labels.has(key)) return labels.get(key)!;
  }
  return formatCellValue(value, column.type);
}
