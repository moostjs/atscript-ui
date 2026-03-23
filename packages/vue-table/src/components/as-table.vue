<script setup lang="ts">
import { computed, triggerRef } from "vue";
import type { ColumnDef } from "@atscript/ui-core";
import { useTableContext } from "../composables/use-table-state";
import { useTableComponent } from "../composables/use-table-component";
import AsTableBase from "./as-table-base.vue";
import { AsTableDefault, AsTableToolbar, AsTablePagination, AsFilterDialog } from "./defaults";

const props = withDefaults(
  defineProps<{
    rows?: Record<string, unknown>[];
    columns?: ColumnDef[];
    stickyHeader?: boolean;
    rowsControl?: "hard-limit" | "pagination" | "load-more-btn" | "scroll-to-load";
    virtualRowHeight?: number;
    virtualOverscan?: number;
    columnMenu?: { sort?: boolean; filters?: boolean; hide?: boolean };
    stretch?: boolean;
  }>(),
  {
    stickyHeader: true,
    rowsControl: "hard-limit",
    virtualRowHeight: 40,
    virtualOverscan: 5,
  },
);

const emit = defineEmits<{
  (e: "row-click", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "row-dblclick", row: Record<string, unknown>, event: MouseEvent): void;
}>();

const { state } = useTableContext();

const TableComp = useTableComponent("table", AsTableDefault);
const ToolbarComp = useTableComponent("toolbar", AsTableToolbar);
const PaginationComp = useTableComponent("pagination", AsTablePagination);
const FilterDialogComp = useTableComponent("filterDialog", AsFilterDialog);

const effectiveRows = computed(() => props.rows ?? state.results.value);
const effectiveColumns = computed(() => props.columns ?? state.columns.value);

function handleHide(column: ColumnDef) {
  state.setColumns(state.columns.value.filter((c) => c.path !== column.path));
}

function handleSort(column: ColumnDef, direction: "asc" | "desc" | null) {
  if (direction === null) {
    state.setSorters(state.sorters.value.filter((s) => s.field !== column.path));
  } else {
    const existing = state.sorters.value.filter((s) => s.field !== column.path);
    state.setSorters([...existing, { field: column.path, direction }]);
  }
}

function handleFilter(column: ColumnDef) {
  state.openFilterDialog(column);
}

function handleSelectionToggle(row: Record<string, unknown>) {
  state.selection.value.toggle(row);
  triggerRef(state.selection);
}
</script>

<template>
  <component :is="TableComp">
    <component :is="ToolbarComp" />

    <AsTableBase
      :columns="effectiveColumns"
      :rows="effectiveRows"
      :sorters="state.sorters.value"
      :selection="state.selection.value"
      :querying="state.querying.value"
      :query-error="state.queryError.value"
      :on-retry="state.query"
      :sticky-header="stickyHeader"
      :virtual-row-height="virtualRowHeight"
      :virtual-overscan="virtualOverscan"
      @sort="handleSort"
      @hide="handleHide"
      @filter="handleFilter"
      @row-click="(row: Record<string, unknown>, ev: MouseEvent) => emit('row-click', row, ev)"
      @row-dblclick="
        (row: Record<string, unknown>, ev: MouseEvent) => emit('row-dblclick', row, ev)
      "
      @selection-toggle="handleSelectionToggle"
    >
      <!-- Pass through all named slots to as-table-base -->
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </AsTableBase>

    <component :is="PaginationComp" :mode="rowsControl" />

    <component :is="FilterDialogComp" />
  </component>
</template>
