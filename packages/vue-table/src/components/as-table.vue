<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { useTableComponent } from "../composables/use-table-component";
import AsTableView from "./as-table-view.vue";
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
    virtualOverscan: 5,
  },
);

const emit = defineEmits<{
  (e: "row-click", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "row-dblclick", row: Record<string, unknown>, event: MouseEvent): void;
}>();

const TableComp = useTableComponent("table", AsTableDefault);
const ToolbarComp = useTableComponent("toolbar", AsTableToolbar);
const PaginationComp = useTableComponent("pagination", AsTablePagination);
const FilterDialogComp = useTableComponent("filterDialog", AsFilterDialog);
</script>

<template>
  <component :is="TableComp">
    <component :is="ToolbarComp" />

    <AsTableView
      :rows="rows"
      :columns="columns"
      :sticky-header="stickyHeader"
      :virtual-row-height="virtualRowHeight"
      :virtual-overscan="virtualOverscan"
      @row-click="(row: Record<string, unknown>, ev: MouseEvent) => emit('row-click', row, ev)"
      @row-dblclick="
        (row: Record<string, unknown>, ev: MouseEvent) => emit('row-dblclick', row, ev)
      "
    >
      <!-- Pass through all named slots to as-table-view → as-table-base -->
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </AsTableView>

    <component :is="PaginationComp" :mode="rowsControl" />

    <component :is="FilterDialogComp" />
  </component>
</template>
