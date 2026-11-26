import { arrangeText, optionLabel, type ColumnDef, type UiT } from "@atscript/ui";
import { formatCellValue } from "./format-cell";
import { getCellValue } from "./get-cell-value";

/**
 * The text the built-in default cell (`AsTableCellValue`) shows: a union or
 * boolean column shows the option label (`@ui.literalLabel`); anything else
 * formats by type (booleans worded with `t`) — a `@ui.valueLabel` column
 * with the row's text of the code (since 0.1.190).
 */
export function displayCellValue(row: Record<string, unknown>, column: ColumnDef, t: UiT): string {
  const value = getCellValue(row, column.path);
  const label = optionLabel(column, value);
  if (label !== undefined) return label;
  const text = formatCellValue(value, column.type, t);
  const valueLabel = column.valueLabel;
  return valueLabel
    ? arrangeText(text, getCellValue(row, valueLabel.path), valueLabel.arrangement)
    : text;
}
