<script setup lang="ts">
import { computed } from "vue";
import type { SortControl, ClientFactory } from "@atscript/ui";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type { ColumnWidthsMap, SelectionMode } from "@atscript/ui-table";
import type { TAsTableComponents } from "../types";
import { useTable } from "../composables/use-table";
import { useRegisterMainActionListener } from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
import { useTableNavBridge } from "../composables/use-table-nav-bridge";
import type { SelectionPersistence } from "../composables/use-table-selection";
import type { PageResult } from "@atscript/db-client";
import { AsFilterDialog, AsConfigDialog } from "./defaults";

const props = withDefaults(
  defineProps<{
    /** Table endpoint URL (e.g. "/db/tables/products"). */
    url: string;
    /** Factory to create a client from a URL. Falls back to the app-wide default set via `setDefaultClientFactory` (or the built-in `new Client(url)` factory if unset). */
    clientFactory?: ClientFactory;
    components?: TAsTableComponents;
    limit?: number;
    forceFilters?: FilterExpr;
    forceSorters?: SortControl[];
    queryOnMount?: boolean;
    queryFn?: (
      query: Uniquery,
      page: number,
      size: number,
    ) => Promise<PageResult<Record<string, unknown>>>;
    blockQuery?: boolean;
    select?: SelectionMode;
    rowValueFn?: (row: Record<string, unknown>) => unknown;
    /**
     * Selection write policy applied on every results-replacement.
     * - `"clear"` — drop everything.
     * - `"trim"` (default) — keep PKs that survive the new result set.
     * - `"persist"` — never write to `selectedRows`; full consumer ownership.
     */
    selectionPersistence?: SelectionPersistence;
    /** Page-alignment unit for `loadRange` and `queryNext` extension. */
    blockSize?: number;
    /** Debounce window for the topIndex/viewportRowCount watcher. */
    dragReleaseDebounceMs?: number;
  }>(),
  {
    queryOnMount: true,
    select: "none",
    selectionPersistence: "trim",
  },
);

const emit = defineEmits<{
  (
    e: "main-action",
    row: Record<string, unknown>,
    absIndex: number,
    event: KeyboardEvent | MouseEvent,
  ): void;
}>();

const filterFields = defineModel<string[]>("filterFields", { default: () => [] });
const columnNames = defineModel<string[]>("columnNames", { default: () => [] });
const columnWidths = defineModel<ColumnWidthsMap>("columnWidths", {
  default: () => ({}),
});
const sorters = defineModel<SortControl[]>("sorters", { default: () => [] });
const selectedRows = defineModel<unknown[]>("selectedRows", { default: () => [] });

const state = useTable(props.url, {
  limit: props.limit,
  select: props.select,
  rowValueFn: props.rowValueFn,
  selectionPersistence: props.selectionPersistence,
  forceFilters: props.forceFilters,
  forceSorters: props.forceSorters,
  queryFn: props.queryFn,
  queryOnMount: props.queryOnMount,
  blockQuery: props.blockQuery,
  blockSize: props.blockSize,
  dragReleaseDebounceMs: props.dragReleaseDebounceMs,
  clientFactory: props.clientFactory,
  components: props.components,
  filterFields,
  columnNames,
  columnWidths,
  sorters,
  selectedRows,
});

useRegisterMainActionListener(
  state,
  (req) => emit("main-action", req.row, req.absIndex, req.event),
  useHasEmitListener("onMainAction"),
);

const navBridge = useTableNavBridge(state);
defineExpose({ state, navBridge });

// Resolve the filter dialog component (cannot use useTableComponent here
// because provideTableContext is called in the same setup by useTable).
const FilterDialogComp = computed(() => props.components?.filterDialog ?? AsFilterDialog);
const ConfigDialogComp = computed(() => props.components?.configDialog ?? AsConfigDialog);
</script>

<template>
  <slot
    :table-def="state.tableDef.value"
    :loading-metadata="state.loadingMetadata.value"
    :all-columns="state.allColumns.value"
    :column-names="state.columnNames.value"
    :column-widths="state.columnWidths.value"
    :columns="state.columns.value"
    :filter-fields="state.filterFields.value"
    :filters="state.filters.value"
    :sorters="state.sorters.value"
    :results="state.results.value"
    :querying="state.querying.value"
    :querying-next="state.queryingNext.value"
    :total-count="state.totalCount.value"
    :loaded-count="state.loadedCount.value"
    :pagination="state.pagination.value"
    :query-error="state.queryError.value"
    :metadata-error="state.metadataError.value"
    :must-refresh="state.mustRefresh.value"
    :search-term="state.searchTerm.value"
    :selected-rows="state.selectedRows.value"
    :selected-count="state.selectedCount.value"
    :nav-bridge="navBridge"
    :query="state.query"
    :query-next="state.queryNext"
    :reset-filters="state.resetFilters"
    :show-config-dialog="state.showConfigDialog"
    :open-filter-dialog="state.openFilterDialog"
    :close-filter-dialog="state.closeFilterDialog"
    :set-field-filter="state.setFieldFilter"
    :remove-field-filter="state.removeFieldFilter"
    :add-filter-field="state.addFilterField"
    :remove-filter-field="state.removeFilterField"
  />

  <component :is="FilterDialogComp" />
  <component :is="ConfigDialogComp" />
</template>
