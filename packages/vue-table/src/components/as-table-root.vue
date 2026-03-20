<script setup lang="ts">
import { provide } from "vue";
import type { SortControl } from "@atscript/ui-core";
import type { FilterExpr } from "@uniqu/core";
import type { SelectionMode } from "@atscript/ui-table";
import type { Uniquery } from "@uniqu/core";
import type { TAsTableComponents } from "../types";
import { useTable, type UseTableClient } from "../composables/use-table";
import { TABLE_COMPONENTS_KEY } from "../composables/use-table-state";

const props = withDefaults(
  defineProps<{
    client: UseTableClient;
    components?: TAsTableComponents;
    limit?: number;
    forceFilters?: FilterExpr;
    forceSorters?: SortControl[];
    queryOnMount?: boolean;
    queryFn?: (query: Uniquery) => Promise<{ data: Record<string, unknown>[]; count: number }>;
    blockQuery?: boolean;
    blockQueryReason?: string;
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

const state = useTable(props.client, {
  limit: props.limit,
  select: props.select,
  rowValueFn: props.rowValueFn,
  keepSelectedAfterRefresh: props.keepSelectedAfterRefresh,
  forceFilters: props.forceFilters,
  forceSorters: props.forceSorters,
  queryFn: props.queryFn,
  queryOnMount: props.queryOnMount,
  blockQuery: props.blockQuery,
});

// Provide components map for child components
if (props.components) {
  provide(TABLE_COMPONENTS_KEY, props.components);
}
</script>

<template>
  <slot
    :table-def="state.tableDef.value"
    :columns="state.columns.value"
    :results="state.results.value"
    :querying="state.querying.value"
    :querying-next="state.queryingNext.value"
    :total-count="state.totalCount.value"
    :loaded-count="state.loadedCount.value"
    :query-error="state.queryError.value"
    :metadata-error="state.metadataError.value"
    :must-refresh="state.mustRefresh.value"
    :search-term="state.searchTerm.value"
    :selected-values="state.selectedValues.value"
    :selected-count="state.selectedCount.value"
    :query="state.query"
    :query-next="state.queryNext"
    :reset-filters="state.resetFilters"
    :show-config-dialog="state.showConfigDialog"
  />
</template>
