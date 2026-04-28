import type { ColumnDef } from "@atscript/ui";
import { computed, type Component, type ComputedRef } from "vue";
import AsTableCellValue from "../components/defaults/as-table-cell-value.vue";
import { useTableContextOptional } from "./use-table-state";

/**
 * Resolves the cell component for each column once per column, keyed by
 * `column.path`. Mirrors the form's resolution order in `as-field.vue`:
 *   1. `@ui.table.component "name"` → `ctx.components[name]`
 *   2. `column.type` → `ctx.types[type]`
 *   3. fallback → `AsTableCellValue`
 *
 * Hoisted out of the per-cell render path because the answer is identical for
 * every row in a given column — a 50×10 table avoids ~500 redundant lookups.
 */
export function useCellComponents(
  getColumns: () => ColumnDef[],
): ComputedRef<Record<string, Component>> {
  const ctx = useTableContextOptional();
  return computed(() => {
    const out: Record<string, Component> = {};
    for (const col of getColumns()) {
      let resolved: Component | undefined;
      if (col.component) resolved = ctx?.components?.[col.component];
      resolved ??= ctx?.types?.[col.type] ?? AsTableCellValue;
      out[col.path] = resolved;
    }
    return out;
  });
}
