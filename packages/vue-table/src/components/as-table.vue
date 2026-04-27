<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { rowsToPks } from "@atscript/ui-table";
import type { ColumnMenuConfig } from "../types";
import { useRegisterMainActionListener, useTableContext } from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
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
  }>(),
  {
    stickyHeader: true,
    virtualOverscan: 5,
    reorderable: true,
    resizable: true,
    columnMinWidth: 48,
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

const effectiveRows = computed(() => props.rows ?? state.results.value);
const effectiveColumns = computed(() => props.columns ?? state.columns.value);

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
      :select="state.selectionMode"
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
