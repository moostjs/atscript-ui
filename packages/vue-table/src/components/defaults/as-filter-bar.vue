<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";
import AsFilterField from "./as-filter-field.vue";

const { state } = useTableContext();

const columnMap = computed(() => {
  const tableDef = state.tableDef.value;
  if (!tableDef) return new Map<string, ColumnDef>();
  const map = new Map<string, ColumnDef>();
  for (const col of tableDef.columns) {
    map.set(col.path, col);
  }
  return map;
});

/** Columns that have an active filter entry (including empty placeholders). */
const activeColumns = computed(() => {
  const map = columnMap.value;
  if (map.size === 0) return [];
  const result: ColumnDef[] = [];
  for (const path in state.filters.value) {
    const col = map.get(path);
    if (col) result.push(col);
  }
  return result;
});

/** Filterable columns that do NOT have an active filter. */
const addableColumns = computed(() => {
  const tableDef = state.tableDef.value;
  if (!tableDef) return [];
  const activeSet = new Set(Object.keys(state.filters.value));
  return tableDef.columns.filter((c) => c.filterable && !activeSet.has(c.path));
});

const hasFilters = computed(() => activeColumns.value.length > 0);
const showBar = computed(() => hasFilters.value || addableColumns.value.length > 0);

function addFilter(column: ColumnDef) {
  // Set placeholder filter to make the inline input appear.
  state.filters.value = {
    ...state.filters.value,
    [column.path]: [{ type: "eq" as const, value: [] }],
  };
}

function clearAll() {
  state.resetFilters();
  state.query();
}
</script>

<template>
  <div v-if="showBar" class="as-filter-bar">
    <AsFilterField
      v-for="col in activeColumns"
      :key="col.path"
      :column="col"
    />

    <PopoverRoot v-if="addableColumns.length > 0">
      <PopoverTrigger class="as-filter-add-btn" aria-label="Add filter"> + Filter </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent class="as-filter-add-content" :side-offset="4" align="start">
          <button
            v-for="col in addableColumns"
            :key="col.path"
            type="button"
            class="as-filter-add-item"
            @click="addFilter(col)"
          >
            {{ col.label }}
          </button>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>

    <button v-if="hasFilters" type="button" class="as-filter-clear-all" @click="clearAll">
      Clear all
    </button>
  </div>
</template>
