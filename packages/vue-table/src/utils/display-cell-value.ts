import { optionLabel, type ColumnDef } from "@atscript/ui";
import { formatCellValue } from "./format-cell";
import { getCellValue } from "./get-cell-value";

/**
 * The text the built-in default cell (`AsTableCellValue`) shows: a union or
 * boolean column shows the option label (`@ui.literalLabel`); anything else
 * formats by type.
 */
export function displayCellValue(row: Record<string, unknown>, column: ColumnDef): string {
  const value = getCellValue(row, column.path);
  return optionLabel(column, value) ?? formatCellValue(value, column.type);
}
