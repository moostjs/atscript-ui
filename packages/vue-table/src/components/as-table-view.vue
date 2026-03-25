<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { ListboxRoot } from "reka-ui";
import { useTableContext } from "../composables/use-table-state";
import AsTableBase from "./as-table-base.vue";

const props = withDefaults(
  defineProps<{
    rows?: Record<string, unknown>[];
    columns?: ColumnDef[];
    stickyHeader?: boolean;
    virtualRowHeight?: number;
    virtualOverscan?: number;
  }>(),
  {
    stickyHeader: true,
    virtualOverscan: 5,
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
  if (direction === null) {
    state.setSorters(state.sorters.value.filter((s) => s.field !== column.path));
  } else {
    const existing = state.sorters.value.filter((s) => s.field !== column.path);
    state.setSorters([...existing, { field: column.path, direction }]);
  }
}

function handleHide(column: ColumnDef) {
  state.setColumns(state.columns.value.filter((c) => c.path !== column.path));
}

function handleFilter(column: ColumnDef) {
  state.openFilterDialog(column);
}

function handleSelectAll() {
  state.selectedRows.value = effectiveRows.value.map((r) => state.rowValueFn(r));
}

function handleDeselectAll() {
  state.selectedRows.value = [];
}
</script>

<template>
  <ListboxRoot
    v-model="listboxModel"
    :multiple="isMulti"
    class="as-table-scroll-container"
    data-virtual-scroll
    style="overflow: auto"
  >
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
      @sort="handleSort"
      @hide="handleHide"
      @filter="handleFilter"
      @select-all="handleSelectAll"
      @deselect-all="handleDeselectAll"
      @row-click="(row: Record<string, unknown>, ev: MouseEvent) => emit('row-click', row, ev)"
      @row-dblclick="
        (row: Record<string, unknown>, ev: MouseEvent) => emit('row-dblclick', row, ev)
      "
    >
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </AsTableBase>
  </ListboxRoot>
</template>
