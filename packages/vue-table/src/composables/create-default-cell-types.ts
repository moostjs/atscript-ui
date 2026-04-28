import type { TAsCellTypeComponents } from "../types";
import { AsTableCellValue } from "../components/defaults";

/**
 * Returns a fresh cell-type-to-component map pre-filled with the built-in
 * `AsTableCellValue` for every known cell type. The default renderer formats
 * the value via {@link formatCellValue} based on `column.type`.
 *
 * Spread or assign additional entries to extend with custom cell types or to
 * replace the renderer for a specific type:
 * ```ts
 * const types = { ...createDefaultCellTypes(), money: MyMoneyCell }
 * ```
 */
export function createDefaultCellTypes(): TAsCellTypeComponents {
  return {
    text: AsTableCellValue,
    number: AsTableCellValue,
    boolean: AsTableCellValue,
    date: AsTableCellValue,
    array: AsTableCellValue,
    object: AsTableCellValue,
    enum: AsTableCellValue,
    ref: AsTableCellValue,
  };
}
