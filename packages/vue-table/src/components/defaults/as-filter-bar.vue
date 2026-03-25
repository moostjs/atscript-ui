<script setup lang="ts">
import { computed, ref } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { isFilled, filterTokenLabel } from "@atscript/ui-table";
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";
import AsFilterRefInline from "./as-filter-ref-inline.vue";

const { state } = useTableContext();

/** Ref column paths the user has opened (even without filter values yet). */
const activeRefPaths = ref(new Set<string>());

const columnMap = computed(() => {
  const tableDef = state.tableDef.value;
  if (!tableDef) return new Map<string, ColumnDef>();
  const map = new Map<string, ColumnDef>();
  for (const col of tableDef.columns) {
    map.set(col.path, col);
  }
  return map;
});

const activeTokenColumns = computed(() => {
  const map = columnMap.value;
  if (map.size === 0) return [];
  const result: { column: ColumnDef; label: string }[] = [];
  for (const path in state.filters.value) {
    const conditions = state.filters.value[path];
    if (conditions.some(isFilled)) {
      const col = map.get(path);
      if (col && !col.valueHelpInfo) {
        result.push({ column: col, label: filterTokenLabel(path, conditions, col.label) });
      }
    }
  }
  return result;
});

const activeRefColumns = computed(() => {
  const map = columnMap.value;
  if (map.size === 0) return [];
  const result: ColumnDef[] = [];
  const seen = new Set<string>();

  for (const path in state.filters.value) {
    const conditions = state.filters.value[path];
    if (conditions.some(isFilled)) {
      const col = map.get(path);
      if (col?.valueHelpInfo) {
        result.push(col);
        seen.add(path);
      }
    }
  }

  for (const path of activeRefPaths.value) {
    if (!seen.has(path)) {
      const col = map.get(path);
      if (col?.valueHelpInfo) {
        result.push(col);
      }
    }
  }

  return result;
});

/** Filterable columns that do NOT have an active filter and are not open as inline. */
const addableColumns = computed(() => {
  const tableDef = state.tableDef.value;
  if (!tableDef) return [];
  const activeSet = new Set(Object.keys(state.filters.value));
  return tableDef.columns.filter(
    (c) => c.filterable && !activeSet.has(c.path) && !activeRefPaths.value.has(c.path),
  );
});

const hasFilters = computed(
  () => activeTokenColumns.value.length > 0 || activeRefColumns.value.length > 0,
);
const showBar = computed(() => hasFilters.value || addableColumns.value.length > 0);

function addFilter(column: ColumnDef) {
  if (column.valueHelpInfo) {
    // Ref column → show inline input
    activeRefPaths.value = new Set([...activeRefPaths.value, column.path]);
  } else {
    // Non-ref → open dialog
    state.openFilterDialog(column);
  }
}

function openFilter(column: ColumnDef) {
  state.openFilterDialog(column);
}

function removeFilter(path: string) {
  state.removeFieldFilter(path);
  state.query();
}

function removeRefFilter(path: string) {
  activeRefPaths.value.delete(path);
  activeRefPaths.value = new Set(activeRefPaths.value);
  state.removeFieldFilter(path);
  state.query();
}

function clearAll() {
  activeRefPaths.value = new Set();
  state.resetFilters();
  state.query();
}
</script>

<template>
  <div v-if="showBar" class="as-filter-bar">
    <AsFilterRefInline
      v-for="col in activeRefColumns"
      :key="col.path"
      :column="col"
      @remove="removeRefFilter(col.path)"
    />

    <button
      v-for="item in activeTokenColumns"
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
