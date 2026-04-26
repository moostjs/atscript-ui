<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { type ColumnReorderPosition, reorderColumnNames } from "@atscript/ui-table";
import { ListboxRoot } from "reka-ui";
import type { ColumnMenuConfig } from "../types";
import { useTableContext } from "../composables/use-table-state";
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
  }>(),
  {
    stickyHeader: true,
    virtualOverscan: 5,
    reorderable: true,
  },
);

const emit = defineEmits<{
  (e: "row-click", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "row-dblclick", row: Record<string, unknown>, event: MouseEvent): void;
}>();

const { state } = useTableContext();

const effectiveRows = computed(() => props.rows ?? state.results.value);
const effectiveColumns = computed(() => props.columns ?? state.columns.value);

const isMulti = state.selectionMode === "multi";

// ListboxRoot v-model: for single-select, convert between single value and array.
// For multi-select, bind selectedRows directly.
const listboxModel = computed({
  get: () => (isMulti ? state.selectedRows.value : (state.selectedRows.value[0] ?? undefined)),
  set: (v) => {
    state.selectedRows.value = Array.isArray(v) ? v : v != null ? [v] : [];
  },
});

function handleSort(column: ColumnDef, direction: "asc" | "desc" | null) {
  const rest = state.sorters.value.filter((s) => s.field !== column.path);
  state.sorters.value = direction === null ? rest : [...rest, { field: column.path, direction }];
}

function handleHide(column: ColumnDef) {
  state.columnNames.value = state.columnNames.value.filter((name) => name !== column.path);
}

function handleFilter(column: ColumnDef) {
  state.openFilterDialog(column);
}

function handleFiltersOff(column: ColumnDef) {
  state.removeFieldFilter(column.path);
}

function handleSelectAll() {
  state.selectedRows.value = effectiveRows.value.map((r) => state.rowValueFn(r));
}

function handleDeselectAll() {
  state.selectedRows.value = [];
}

function handleClearFilters() {
  state.resetFilters();
  if (state.searchTerm.value) state.searchTerm.value = "";
}

function handleReorder(fromPath: string, toPath: string, position: ColumnReorderPosition) {
  state.columnNames.value = reorderColumnNames(state.columnNames.value, fromPath, toPath, position);
}
</script>

<template>
  <ListboxRoot v-model="listboxModel" :multiple="isMulti" class="as-table-outer-wrap">
    <AsTableBase
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
      :on-clear-filters="handleClearFilters"
      :column-menu="columnMenu"
      :reorderable="reorderable"
      @sort="handleSort"
      @hide="handleHide"
      @filter="handleFilter"
      @filters-off="handleFiltersOff"
      @select-all="handleSelectAll"
      @deselect-all="handleDeselectAll"
      @reorder="handleReorder"
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
  </ListboxRoot>
</template>
