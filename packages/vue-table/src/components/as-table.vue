<script setup lang="ts">
import { computed, watch } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { SelectionMode } from "@atscript/ui-table";
import {
  type ColumnMenuConfig,
  type RowActionsColumnPlacement,
  type RowAttrsHook,
  type RowClassHook,
  type RowDeleteOpt,
  type RowSelectableHook,
} from "../types";
import { useRegisterMainActionListener, useTableContext } from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
import { useSelectModeReset } from "../composables/use-table-selection";
import { useTableColumnHandlers } from "../composables/use-table-column-handlers";
import { useRowActionsColumn } from "../composables/use-row-actions-column";
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
    rowActionsColumn?: RowActionsColumnPlacement | false;
    /**
     * Render without a header row. Omits `<thead>` entirely (not
     * `display:none`); column widths are carried by the `<colgroup>`, so data
     * columns keep their annotated/seeded widths. Header-driven interactions
     * (sort/filter/reorder/resize) are unavailable in headless mode.
     */
    headless?: boolean;
    /**
     * Per-row selectability. Return `false` — or a string, surfaced as the
     * disabled reason on the row's selection control — to make a row not
     * selectable. Enforced on every path: row click, Space/Enter toggle, and
     * the header select-all (which also stops counting ineligible rows).
     * Since 0.1.133.
     *
     * @example
     * `:row-selectable="(row) => row.locked ? 'Locked by another user' : true"`
     */
    rowSelectable?: RowSelectableHook;
    /**
     * Extra classes for the row element — string, array, or
     * `{ class: boolean }` map, merged with the framework's own row classes.
     * Since 0.1.133.
     */
    rowClass?: RowClassHook;
    /**
     * Extra attributes for the row element. The framework's own `id`, `role`,
     * `aria-*`, `data-*`, `class` and `style` always win, so a hook can
     * decorate a row but never rewrite its accessibility contract.
     * Since 0.1.133.
     */
    rowAttrs?: RowAttrsHook;
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
    headless: false,
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

// Renderer-pushed like `rowDelete`: the selection model owns the rule, so
// click / Space / Enter / select-all all gate on the same predicate.
watch(
  () => props.rowSelectable,
  (val) => {
    state.rowSelectable.value = val;
  },
  { immediate: true },
);

useSelectModeReset(state, () => props.select);

// `applyLocalSort` re-orders the loaded page by any sorter that targets a
// client-owned (`:display-columns`) column — those never reach the server, so
// the renderer is where they take effect. A no-op (same array reference) for
// tables without such a sorter.
const effectiveRows = computed<Record<string, unknown>[]>(() =>
  state.applyLocalSort(props.rows ?? state.results.value),
);

const effectiveColumns = useRowActionsColumn(state, {
  placement: () => props.rowActionsColumn,
  select: () => props.select,
  columns: () => props.columns ?? state.columns.value,
});

useRegisterMainActionListener(
  state,
  (req) => emit("main-action", req.row, req.absIndex, req.event),
  useHasEmitListener("onMainAction"),
);

const { onSort, onHide, onFilter, onFiltersOff, onResetWidth, onReorder, onClearFilters } =
  useTableColumnHandlers(state);

function handleSelectAll() {
  state.selectAll(effectiveRows.value);
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
      :headless="headless"
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
      :row-class="rowClass"
      :row-attrs="rowAttrs"
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
