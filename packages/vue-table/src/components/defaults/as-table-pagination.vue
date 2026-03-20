<script setup lang="ts">
import { computed } from "vue";
import { useTableState } from "../../composables/use-table-state";

const props = withDefaults(
  defineProps<{
    mode?: "hard-limit" | "pagination" | "load-more-btn" | "scroll-to-load";
  }>(),
  {
    mode: "hard-limit",
  },
);

const state = useTableState();

const currentPage = computed(() => state.pagination.value.page);
const itemsPerPage = computed(() => state.pagination.value.itemsPerPage);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(state.totalCount.value / itemsPerPage.value)),
);
const hasMore = computed(() => state.loadedCount.value < state.totalCount.value);

function prevPage() {
  if (currentPage.value <= 1) return;
  state.pagination.value = { ...state.pagination.value, page: currentPage.value - 1 };
}

function nextPage() {
  if (currentPage.value >= totalPages.value) return;
  state.pagination.value = { ...state.pagination.value, page: currentPage.value + 1 };
}

function setItemsPerPage(value: number) {
  state.pagination.value = { page: 1, itemsPerPage: value };
}
</script>

<template>
  <div v-if="props.mode === 'hard-limit'" class="as-table-pagination">
    <span>Showing {{ state.loadedCount.value }} of {{ state.totalCount.value }}</span>
  </div>

  <div v-else-if="props.mode === 'pagination'" class="as-table-pagination">
    <div class="as-table-pagination-controls">
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
  </div>

  <div v-else-if="props.mode === 'load-more-btn'" class="as-table-pagination">
    <button
      v-if="hasMore"
      type="button"
      class="as-table-load-more"
      :disabled="state.queryingNext.value"
      @click="state.queryNext()"
    >
      {{ state.queryingNext.value ? "Loading..." : "Load More" }}
    </button>
    <span v-else>All {{ state.totalCount.value }} rows loaded</span>
  </div>

  <div v-else-if="props.mode === 'scroll-to-load'" class="as-table-pagination">
    <span v-if="!hasMore">All {{ state.totalCount.value }} rows loaded</span>
  </div>
</template>
