import { computed, watch, type ComputedRef } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { SelectionMode } from "@atscript/ui-table";
import {
  ROW_ACTIONS_PATH,
  ROW_ACTIONS_TYPE,
  type ReactiveTableState,
  type RowActionsColumnPlacement,
} from "../types";

/**
 * The synthesised row-actions pseudo-column, shared by `<AsTable>` and
 * `<AsWindowTable>`. Returns the renderer's effective column list — the base
 * columns with a fixed `__actions` column prepended / appended per
 * `placement` — and opts the table into per-row `$actions` while the column
 * is shown.
 */
export function useRowActionsColumn(
  state: ReactiveTableState,
  opts: {
    placement: () => RowActionsColumnPlacement | false | undefined;
    select: () => SelectionMode;
    columns: () => ColumnDef[];
  },
): ComputedRef<ColumnDef[]> {
  // `?$actions=true` is gated on this watcher so tables without a row-actions
  // column don't pay the per-row payload cost.
  watch(
    () => {
      const placement = opts.placement();
      if (!placement) return false;
      if (placement === "merge-select" && opts.select() !== "none") return false;
      return state.actions.cellRow.length > 0;
    },
    (on) => {
      state.includeActions.value = on;
    },
    { immediate: true },
  );

  // Width adapts to the row-action shape so the column hugs its content:
  //   - 0 or >1 actions OR single icon action → 4em (matches the multi-select
  //     checkbox column `as-th-select`/`as-td-select`, so square icon
  //     buttons line up with checkboxes visually).
  //   - single label-only action (e.g. customers' "View orders") → 8em
  //     (fits typical short labels with the chrome-button padding).
  // Setting `col.width` flows through `reconcileColumnWidthDefaults` →
  // `state.columnWidths` → `widthStyle` → inline `width` on the TH, which
  // `table-layout: fixed` then locks the column to.
  const actionsCol = computed<ColumnDef>(() => {
    const acts = state.actions.row;
    const isLabelOnly = acts.length === 1 && !acts[0]?.icon;
    return {
      path: ROW_ACTIONS_PATH,
      label: "",
      type: ROW_ACTIONS_TYPE,
      sortable: false,
      filterable: false,
      nullable: false,
      order: 0,
      fixed: true,
      width: isLabelOnly ? "8em" : "4em",
    };
  });

  return computed(() => {
    const base = opts.columns();
    const placement = opts.placement();
    if (placement === false || placement === undefined) return base;
    if (state.actions.row.length === 0) return base;
    if (placement === "first") return [actionsCol.value, ...base];
    if (placement === "last") return [...base, actionsCol.value];
    // 'merge-select': only in select="none". In select="multi" the checkbox
    // column owns the leading gutter; the actions surface through the toolbar
    // `<AsTableActions>` (selection-aware) instead.
    if (opts.select() === "none") return [actionsCol.value, ...base];
    return base;
  });
}
