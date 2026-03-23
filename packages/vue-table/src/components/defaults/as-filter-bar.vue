<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui-core";
import { isFilled, filterTokenLabel } from "@atscript/ui-table";
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";

const { state } = useTableContext();

/** Columns that have active (filled) filters. */
const activeFilterColumns = computed(() => {
  const tableDef = state.tableDef.value;
  if (!tableDef) return [];
  const result: { column: ColumnDef; label: string }[] = [];
  for (const path in state.filters.value) {
    const conditions = state.filters.value[path];
    if (conditions.some(isFilled)) {
      const col = tableDef.columns.find((c) => c.path === path);
      if (col) {
        result.push({
          column: col,
          label: filterTokenLabel(path, conditions, col.label),
        });
      }
    }
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

const hasFilters = computed(() => activeFilterColumns.value.length > 0);
const showBar = computed(() => hasFilters.value || addableColumns.value.length > 0);

function openFilter(column: ColumnDef) {
  state.openFilterDialog(column);
}

function removeFilter(path: string) {
  state.removeFieldFilter(path);
  state.query();
}

function clearAll() {
  state.resetFilters();
  state.query();
}
</script>

<template>
  <div v-if="showBar" class="as-filter-bar">
    <button
      v-for="item in activeFilterColumns"
      :key="item.column.path"
      type="button"
      class="as-filter-token"
      @click="openFilter(item.column)"
    >
      <span class="as-filter-token-label">{{ item.label }}</span>
      <span
        class="as-filter-token-remove"
        role="button"
        tabindex="0"
        aria-label="Remove filter"
        @click.stop="removeFilter(item.column.path)"
        @keydown.enter.stop="removeFilter(item.column.path)"
      >
        &times;
      </span>
    </button>

    <PopoverRoot v-if="addableColumns.length > 0">
      <PopoverTrigger class="as-filter-add-btn" aria-label="Add filter"> + Filter </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent class="as-filter-add-content" :side-offset="4" align="start">
          <button
            v-for="col in addableColumns"
            :key="col.path"
            type="button"
            class="as-filter-add-item"
            @click="openFilter(col)"
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
