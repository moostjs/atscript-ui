import { ROW_ACTIONS_TYPE, type TAsCellTypeComponents } from "../types";
import {
  AsCellArray,
  AsCellDate,
  AsCellJson,
  AsCellNumber,
  AsRowActions,
  AsTableCellValue,
} from "../components/defaults";

/**
 * Returns a fresh cell-type-to-component map pre-filled with the built-in
 * defaults. Spread to extend or override:
 * ```ts
 * const types = { ...createDefaultCellTypes(), status: StatusBadgeCell }
 * ```
 */
export function createDefaultCellTypes(): TAsCellTypeComponents {
  return {
    text: AsTableCellValue,
    number: AsCellNumber,
    boolean: AsTableCellValue,
    date: AsCellDate,
    datetime: AsCellDate,
    relative: AsCellDate,
    array: AsCellArray,
    object: AsCellJson,
    enum: AsTableCellValue,
    ref: AsTableCellValue,
    /** Synthesised row-actions pseudo-column (`:rowActionsColumn` opt-in). */
    [ROW_ACTIONS_TYPE]: AsRowActions,
  };
}
