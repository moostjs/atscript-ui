import type { TAsTableControls } from "../types";
import {
  AsColumnMenu,
  AsConfigDialog,
  AsConfirmDialog,
  AsFilterDialog,
  AsFilterField,
  AsFilterInput,
  AsTableHeaderCell,
} from "../components/defaults";

/**
 * Returns a fresh skin-slot map pre-filled with all built-in defaults.
 *
 * Spread or assign additional entries to override specific pieces:
 * ```ts
 * const controls = { ...createDefaultControls(), filterDialog: MyFilterDialog }
 * ```
 *
 * `rowActions` is intentionally not seeded — the row-actions column
 * already falls back to the `types` map's `__actions` entry and then the
 * built-in renderer. Set `controls.rowActions` only to override explicitly
 * (it wins over the `types` entry).
 *
 * `actionFormDialog` is intentionally not seeded — the table root
 * lazy-mounts it only when an `@InputForm` action is detected. To override
 * or eager-load, import from `@atscript/vue-table/as-action-form-dialog`
 * and assign it as the `actionFormDialog` entry on this map.
 */
export function createDefaultControls(): TAsTableControls {
  return {
    headerCell: AsTableHeaderCell,
    columnMenu: AsColumnMenu,
    filterDialog: AsFilterDialog,
    filterInput: AsFilterInput,
    filterField: AsFilterField,
    configDialog: AsConfigDialog,
    confirmDialog: AsConfirmDialog,
  };
}
