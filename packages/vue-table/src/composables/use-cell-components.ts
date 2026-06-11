import type { ColumnDef } from "@atscript/ui";
import { computed, type Component, type ComputedRef } from "vue";
import { ROW_ACTIONS_TYPE } from "../types";
import { AsRowActions, AsTableCellValue } from "../components/defaults";
import { useTableComponent } from "./use-table-component";
import { useTableContextOptional } from "./use-table-state";

/**
 * Resolves the cell component for each column once per column, keyed by
 * `column.path`. Mirrors the form's resolution order in `as-field.vue`:
 *   1. `@ui.table.component "name"` → `ctx.components[name]`
 *   2. `column.type` → `ctx.types[type]`
 *   3. fallback → `AsTableCellValue`
 *
 * The synthesized `__actions` pseudo-column is chrome, not data — it
 * dispatches through `controls.rowActions` first, then the `:types` entry,
 * then the built-in `AsRowActions`.
 *
 * Hoisted out of the per-cell render path because the answer is identical for
 * every row in a given column — a 50×10 table avoids ~500 redundant lookups.
 */
export function useCellComponents(
  getColumns: () => ColumnDef[],
): ComputedRef<Record<string, Component>> {
  const ctx = useTableContextOptional();
  const RowActions = useTableComponent(
    "rowActions",
    ctx?.types?.[ROW_ACTIONS_TYPE] ?? AsRowActions,
  );
  return computed(() => {
    const out: Record<string, Component> = {};
    for (const col of getColumns()) {
      if (col.type === ROW_ACTIONS_TYPE) {
        out[col.path] = RowActions;
        continue;
      }
      let resolved: Component | undefined;
      if (col.component) resolved = ctx?.components?.[col.component];
      resolved ??= ctx?.types?.[col.type] ?? AsTableCellValue;
      out[col.path] = resolved;
    }
    return out;
  });
}
