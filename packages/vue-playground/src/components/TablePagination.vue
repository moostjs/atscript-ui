<script setup lang="ts">
import { computed } from "vue";
import { useTableContext } from "@atscript/vue-table";

const props = withDefaults(
  defineProps<{
    mode?: "pagination" | "load-more";
  }>(),
  { mode: "pagination" },
);

const { state } = useTableContext();

const currentPage = computed(() => state.pagination.value.page);
const itemsPerPage = computed(() => state.pagination.value.itemsPerPage);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(state.totalCount.value / itemsPerPage.value)),
);
const hasMore = computed(() => state.loadedCount.value < state.totalCount.value);

function prevPage() {
  if (currentPage.value <= 1) return;
  state.pagination.value = { ...state.pagination.value, page: currentPage.value - 1 };
  state.query();
}

function nextPage() {
  if (currentPage.value >= totalPages.value) return;
  state.pagination.value = { ...state.pagination.value, page: currentPage.value + 1 };
  state.query();
}

function setItemsPerPage(value: number) {
  state.pagination.value = { page: 1, itemsPerPage: value };
  state.query();
}
</script>

<template>
  <div v-if="mode === 'pagination'" class="table-pagination">
    <select
      :value="itemsPerPage"
      @change="setItemsPerPage(Number(($event.target as HTMLSelectElement).value))"
    >
      <option :value="10">10</option>
      <option :value="25">25</option>
      <option :value="50">50</option>
      <option :value="100">100</option>
    </select>
    <button type="button" :disabled="currentPage <= 1" @click="prevPage">&laquo; Prev</button>
    <span>Page {{ currentPage }} of {{ totalPages }}</span>
    <button type="button" :disabled="currentPage >= totalPages" @click="nextPage">
      Next &raquo;
    </button>
  </div>

  <div v-else-if="mode === 'load-more'" class="table-pagination">
    <button
      v-if="hasMore"
      type="button"
      class="load-more-btn"
      :disabled="state.queryingNext.value"
      @click="state.queryNext()"
    >
      {{ state.queryingNext.value ? "Loading..." : "Load More" }}
    </button>
    <span v-else>All {{ state.totalCount.value }} rows loaded</span>
  </div>
</template>

<style scoped>
.table-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  color: #6b7280;
}
.table-pagination button {
  padding: 4px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.table-pagination button:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}
.table-pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.table-pagination select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}
.load-more-btn {
  padding: 6px 20px;
  border: 1px solid #6366f1;
  border-radius: 6px;
  background: #fff;
  color: #6366f1;
  font-weight: 500;
}
.load-more-btn:hover:not(:disabled) {
  background: #eef2ff;
}
</style>
