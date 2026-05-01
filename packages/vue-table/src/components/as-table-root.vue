<script setup lang="ts">
import type { Component } from "vue";
import type { SortControl, ClientFactory } from "@atscript/ui";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type { ColumnWidthsMap } from "@atscript/ui-table";
import type {
  ActionResult,
  TAsCellTypeComponents,
  TAsTableControls,
  TVueTableActionInfo,
} from "../types";
import { useTable } from "../composables/use-table";
import { useRegisterMainActionListener } from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
import { useTableNavBridge } from "../composables/use-table-nav-bridge";
import type { SelectionPersistence } from "../composables/use-table-selection";
import type { PageResult } from "@atscript/db-client";
import { AsFilterDialog, AsConfigDialog, AsConfirmDialog } from "./defaults";

const props = withDefaults(
  defineProps<{
    /** Table endpoint URL (e.g. "/db/tables/products"). */
    url: string;
    /** Factory to create a client from a URL. Falls back to the app-wide default set via `setDefaultClientFactory` (or the built-in `new Client(url)` factory if unset). */
    clientFactory?: ClientFactory;
    /** Skin-slot overrides for table chrome — header cells, filter dialog, column menu, etc. Use {@link createDefaultControls} to seed defaults. */
    controls?: TAsTableControls;
    /** Cell-type → component dispatch map. Use {@link createDefaultCellTypes} to seed defaults. */
    types?: TAsCellTypeComponents;
    /** Named cell-component overrides — looked up by `@ui.table.component "name"`. */
    components?: Record<string, Component>;
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
    /**
     * Refetch policy: when `true` (default), successful `'backend'` /
     * `'__remove'` invocations call `state.query()` after settling. Per-call
     * `state.actions.invoke(action, pk, { suppressRefresh: true })` overrides.
     */
    refreshOnAction?: boolean;
  }>(),
  {
    queryOnMount: true,
    selectionPersistence: "trim",
    refreshOnAction: true,
  },
);

const emit = defineEmits<{
  (
    e: "main-action",
    row: Record<string, unknown>,
    absIndex: number,
    event: KeyboardEvent | MouseEvent,
  ): void;
  (
    e: "action",
    action: TVueTableActionInfo,
    ids: unknown[],
    result: ActionResult,
    event?: KeyboardEvent | MouseEvent,
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
  // `select` is owned by `<AsTable>` / `<AsWindowTable>`, not the orchestrator.
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
  controls: props.controls,
  types: props.types,
  components: props.components,
  refreshOnAction: () => props.refreshOnAction,
  onActionResolved: (action, ids, result, event) => {
    emit("action", action, ids, result, event);
  },
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
    :actions="state.actions"
    :prompt="state.prompt"
  />

  <component :is="props.controls?.filterDialog ?? AsFilterDialog" />
  <component :is="props.controls?.configDialog ?? AsConfigDialog" />
  <component :is="props.controls?.confirmDialog ?? AsConfirmDialog" />
</template>
