<script setup lang="ts">
import { computed } from "vue";
import { AsFilters, useTableContext } from "@atscript/vue-table";

const { state } = useTableContext();

const hasFilters = computed(() => state.filterFields.value.length > 0);

function clearAll() {
  // Just clear filters — the framework's filters watcher picks up the
  // change and re-queries (debounced). Calling `state.query()` here would
  // fire an extra fetch on top of that, AND would still query when
  // filters were already empty (since `resetFilters` is a no-op then).
  state.resetFilters();
}
</script>

<template>
  <div v-if="hasFilters" class="filter-bar">
    <AsFilters />
    <button type="button" class="clear-all-btn" @click="clearAll">Clear all</button>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.clear-all-btn {
  padding: 3px 10px;
  border: none;
  background: none;
  font-size: 12px;
  color: #ef4444;
  cursor: pointer;
  white-space: nowrap;
}
.clear-all-btn:hover {
  text-decoration: underline;
}
</style>
