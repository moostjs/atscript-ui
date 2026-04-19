<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { FilterCondition } from "@atscript/ui-table";
import { isFilled } from "@atscript/ui-table";
import type { ColumnMenuConfig } from "../types";
import AsColumnMenu from "./defaults/as-column-menu.vue";

const props = withDefaults(
  defineProps<{
    column: ColumnDef;
    sortDirection?: "asc" | "desc" | null;
    filters?: FilterCondition[];
    columnMenu?: ColumnMenuConfig;
  }>(),
  {
    columnMenu: () => ({ sort: true, filters: true, hide: true }),
  },
);

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
  (e: "filter", column: ColumnDef): void;
  (e: "filters-off", column: ColumnDef): void;
}>();

const filledCount = computed(() => props.filters?.filter(isFilled).length ?? 0);

function onMenuSort(direction: "asc" | "desc" | null) {
  emit("sort", props.column, direction);
}

function onMenuHide() {
  emit("hide", props.column);
}

function onMenuFilter() {
  emit("filter", props.column);
}

function onMenuFiltersOff() {
  emit("filters-off", props.column);
}
</script>

<template>
  <th :style="props.column.width ? { width: props.column.width } : undefined">
    <AsColumnMenu
      :column="props.column"
      :order="sortDirection"
      :filters="filters"
      :config="columnMenu"
      @sort="onMenuSort"
      @hide="onMenuHide"
      @filter="onMenuFilter"
      @filters-off="onMenuFiltersOff"
      v-slot="{ open, hasMenu }"
    >
      <button class="as-th-btn" type="button">
        <span class="as-th-label">{{ props.column.label }}</span>
        <span class="as-th-indicators">
          <span v-if="filledCount" class="as-th-filter-badge i-as-filter" aria-hidden="true" />
          <span
            v-if="sortDirection"
            class="as-th-sort"
            :class="sortDirection === 'asc' ? 'i-as-arrow-up' : 'i-as-arrow-down'"
            aria-hidden="true"
          />
          <span
            v-if="hasMenu && !sortDirection && !filledCount"
            class="as-th-chevron"
            :class="open ? 'i-as-chevron-up' : 'i-as-chevron-down'"
            aria-hidden="true"
          />
        </span>
      </button>
    </AsColumnMenu>
  </th>
</template>
