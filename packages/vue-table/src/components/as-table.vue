<script setup lang="ts">
import { computed, watch } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { rowsToPks, type SelectionMode } from "@atscript/ui-table";
import {
  ROW_ACTIONS_PATH,
  ROW_ACTIONS_TYPE,
  type ColumnMenuConfig,
  type RowDeleteOpt,
} from "../types";
import { useRegisterMainActionListener, useTableContext } from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
import { useSelectModeReset } from "../composables/use-table-selection";
import { useTableColumnHandlers } from "../composables/use-table-column-handlers";
import AsTableBase from "./internal/as-table-base.vue";

const props = withDefaults(
  defineProps<{
    rows?: Record<string, unknown>[];
    columns?: ColumnDef[];
    stickyHeader?: boolean;
    virtualRowHeight?: number;
    virtualOverscan?: number;
    columnMenu?: ColumnMenuConfig;
    /** Allow header drag-and-drop column reorder. Default true. */
    reorderable?: boolean;
    /** Allow header drag-resize. Default true. */
    resizable?: boolean;
    /** Pixel floor for the resize clamp. Default 48. */
    columnMinWidth?: number;
    /**
     * Selection mode — rendering concern owned by the renderer. `"multi"`
     * shows a leading checkbox column and turns row clicks into selection
     * toggles; `"none"` (default) hides the column and routes clicks
     * through the main-action path. Independent of `state.selectedRows` —
     * flipping `select` to `"none"` hides the checkbox UI but leaves the
     * user's selected pks in place, surviving a future re-enable.
     */
    select?: SelectionMode;
    /**
     * Built-in row-delete: `false` (off, default), `true` (on with defaults),
     * or a `RowDeleteOpt` overriding label/icon/intent/promptText. The
     * synthesised `__remove` action only appears when the consumer opts in
     * AND `tableDef.canRemove === true`. Pushed into `state.rowDelete` via
     * a watcher — the action set live-updates as the prop flips.
     */
    rowDelete?: boolean | RowDeleteOpt;
    /**
     * Synthesised row-actions pseudo-column. `'first'` / `'last'` prepend or
     * append a fixed `__actions` column rendering `controls.rowActions`.
     * `'merge-select'` only renders the column when `select === "none"` —
     * sharing the leading gutter with the multi-select checkbox column so the
     * row gutter shows a checkbox in `select="multi"` mode and an action
     * trigger in `select="none"` mode (toggled at the consumer level).
     *
     * The column is locked: no header dropdown, no resize, no drag-reorder,
     * NOT in the `columnNames` v-model. Hidden entirely when
     * `state.actions.row` is empty.
     *
     * Wrapper-only prop — not forwarded by `<AsTableRoot>`. Raw consumers
     * compose their own column layout.
     */
    rowActionsColumn?: "first" | "last" | "merge-select" | false;
  }>(),
  {
    stickyHeader: true,
    virtualOverscan: 5,
    reorderable: true,
    resizable: true,
    columnMinWidth: 48,
    select: "none",
    rowDelete: false,
    rowActionsColumn: false,
  },
);

const emit = defineEmits<{
  (e: "row-click", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "row-dblclick", row: Record<string, unknown>, event: MouseEvent): void;
  (
    e: "main-action",
    row: Record<string, unknown>,
    absIndex: number,
    event: KeyboardEvent | MouseEvent,
  ): void;
}>();

const { state } = useTableContext();

watch(
  () => props.rowDelete,
  (val) => {
    state.rowDelete.value = val;
  },
  { immediate: true },
);

useSelectModeReset(state, () => props.select);

// `?$actions=true` is gated on this watcher so tables without a row-actions
// column don't pay the per-row payload cost.
watch(
  () => {
    const placement = props.rowActionsColumn;
    if (!placement) return false;
    if (placement === "merge-select" && props.select !== "none") return false;
    return state.actions.cellRow.length > 0;
  },
  (on) => {
    state.includeActions.value = on;
  },
  { immediate: true },
);

const effectiveRows = computed(() => props.rows ?? state.results.value);

// Synthesized actions column. Width adapts to the row-action shape so it
// hugs its content:
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
    visible: true,
    order: 0,
    fixed: true,
    width: isLabelOnly ? "8em" : "4em",
  };
});

const effectiveColumns = computed(() => {
  const base = props.columns ?? state.columns.value;
  const placement = props.rowActionsColumn;
  if (placement === false || placement === undefined) return base;
  if (state.actions.row.length === 0) return base;
  if (placement === "first") return [actionsCol.value, ...base];
  if (placement === "last") return [...base, actionsCol.value];
  // 'merge-select': only in select="none". In select="multi" the checkbox
  // column owns the leading gutter; the actions surface through the toolbar
  // `<AsTableActions>` (selection-aware) instead.
  if (props.select === "none") return [actionsCol.value, ...base];
  return base;
});

useRegisterMainActionListener(
  state,
  (req) => emit("main-action", req.row, req.absIndex, req.event),
  useHasEmitListener("onMainAction"),
);

const { onSort, onHide, onFilter, onFiltersOff, onResetWidth, onReorder, onClearFilters } =
  useTableColumnHandlers(state);

function handleSelectAll() {
  state.selectedRows.value = rowsToPks(effectiveRows.value, state.rowValueFn);
}

function handleDeselectAll() {
  state.selectedRows.value = [];
}
</script>

<template>
  <div class="as-table-outer-wrap">
    <AsTableBase
      render-mode="standalone"
      :columns="effectiveColumns"
      :rows="effectiveRows"
      :sorters="state.sorters.value"
      :selected-rows="state.selectedRows.value"
      :select="props.select"
      :row-value-fn="state.rowValueFn"
      :querying="state.querying.value"
      :query-error="state.queryError.value"
      :on-retry="state.query"
      :sticky-header="stickyHeader"
      :virtual-row-height="virtualRowHeight"
      :virtual-overscan="virtualOverscan"
      :filters="state.filters.value"
      :search-term="state.searchTerm.value"
      :on-clear-filters="onClearFilters"
      :column-menu="columnMenu"
      :reorderable="reorderable"
      :resizable="resizable"
      :column-min-width="columnMinWidth"
      :column-widths="state.columnWidths.value"
      @sort="onSort"
      @hide="onHide"
      @filter="onFilter"
      @filters-off="onFiltersOff"
      @select-all="handleSelectAll"
      @deselect-all="handleDeselectAll"
      @reorder="onReorder"
      @resize="state.setColumnWidth"
      @reset-width="onResetWidth"
      @row-click="(row: Record<string, unknown>, ev: MouseEvent) => emit('row-click', row, ev)"
      @row-dblclick="
        (row: Record<string, unknown>, ev: MouseEvent) => emit('row-dblclick', row, ev)
      "
    >
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </AsTableBase>
    <div v-if="state.querying.value" class="as-table-query-overlay">
      <slot name="query-loading">
        <span class="as-table-query-overlay-icon" aria-hidden="true" />
      </slot>
    </div>
  </div>
</template>
