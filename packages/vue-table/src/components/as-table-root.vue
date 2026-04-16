<script setup lang="ts">
import { computed } from "vue";
import type { SortControl } from "@atscript/ui";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type { SelectionMode } from "@atscript/ui-table";
import type { TAsTableComponents } from "../types";
import { useTable, type TableClientFactory } from "../composables/use-table";
import type { PageResult } from "@atscript/db-client";
import { AsFilterDialog } from "./defaults";

const props = withDefaults(
  defineProps<{
    /** Table endpoint URL (e.g. "/db/tables/products"). */
    url: string;
    /** Factory to create a client from a URL. Falls back to default factory. */
    clientFactory?: TableClientFactory;
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
    keepSelectedAfterRefresh?: boolean;
  }>(),
  {
    queryOnMount: true,
    select: "none",
    keepSelectedAfterRefresh: false,
  },
);

const state = useTable(props.url, {
  limit: props.limit,
  select: props.select,
  rowValueFn: props.rowValueFn,
  keepSelectedAfterRefresh: props.keepSelectedAfterRefresh,
  forceFilters: props.forceFilters,
  forceSorters: props.forceSorters,
  queryFn: props.queryFn,
  queryOnMount: props.queryOnMount,
  blockQuery: props.blockQuery,
  clientFactory: props.clientFactory,
  components: props.components,
});

// Resolve the filter dialog component (cannot use useTableComponent here
// because provideTableContext is called in the same setup by useTable).
const FilterDialogComp = computed(
  () => props.components?.filterDialog ?? AsFilterDialog,
);
</script>

<template>
  <slot
    :table-def="state.tableDef.value"
    :all-columns="state.allColumns.value"
    :columns="state.columns.value"
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
    :query="state.query"
    :query-next="state.queryNext"
    :reset-filters="state.resetFilters"
    :show-config-dialog="state.showConfigDialog"
    :open-filter-dialog="state.openFilterDialog"
    :close-filter-dialog="state.closeFilterDialog"
    :set-field-filter="state.setFieldFilter"
    :remove-field-filter="state.removeFieldFilter"
  />

  <!-- Dialogs rendered outside user layout (like not-sap SmartTableRoot) -->
  <component :is="FilterDialogComp" />
</template>
