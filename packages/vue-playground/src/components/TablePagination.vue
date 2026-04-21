<script setup lang="ts">
import { computed } from "vue";
import { useTableContext } from "@atscript/vue-table";
import {
  PaginationRoot,
  PaginationList,
  PaginationListItem,
  PaginationFirst,
  PaginationPrev,
  PaginationNext,
  PaginationLast,
  PaginationEllipsis,
} from "reka-ui";
import VuSelect from "vunor/Select";
import VuButton from "vunor/Button";

const props = withDefaults(
  defineProps<{
    mode?: "pagination" | "load-more";
  }>(),
  { mode: "pagination" },
);

const { state } = useTableContext();

const currentPage = computed({
  get: () => state.pagination.value.page,
  set: (page) => {
    state.pagination.value = { ...state.pagination.value, page };
  },
});

const itemsPerPage = computed({
  get: () => String(state.pagination.value.itemsPerPage),
  set: (value) => {
    state.pagination.value = { page: 1, itemsPerPage: Number(value) };
  },
});

const hasMore = computed(() => state.loadedCount.value < state.totalCount.value);

const pageSizeItems = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];
</script>

<template>
  <div class="table-pagination">
    <template v-if="mode === 'pagination'">
      <div class="table-pagination-size">
        <VuSelect v-model="itemsPerPage" :items="pageSizeItems" />
      </div>
      <PaginationRoot
        v-slot="{ page }"
        :page="currentPage"
        :total="state.totalCount.value"
        :items-per-page="state.pagination.value.itemsPerPage"
        :sibling-count="1"
        show-edges
        @update:page="currentPage = $event"
      >
        <PaginationList v-slot="{ items }" class="table-pagination-list">
          <PaginationFirst class="table-pagination-btn">
            <span class="i-as-chevron-double-left" aria-hidden="true" />
          </PaginationFirst>
          <PaginationPrev class="table-pagination-btn">
            <span class="i-as-chevron-left" aria-hidden="true" />
          </PaginationPrev>
          <template v-for="(item, i) in items" :key="i">
            <PaginationListItem
              v-if="item.type === 'page'"
              :value="item.value"
              class="table-pagination-btn"
              :class="{ 'table-pagination-btn-active': item.value === page }"
            >
              {{ item.value }}
            </PaginationListItem>
            <PaginationEllipsis v-else :index="i" class="table-pagination-ellipsis">
              <span class="i-as-ellipsis" aria-hidden="true" />
            </PaginationEllipsis>
          </template>
          <PaginationNext class="table-pagination-btn">
            <span class="i-as-chevron-right" aria-hidden="true" />
          </PaginationNext>
          <PaginationLast class="table-pagination-btn">
            <span class="i-as-chevron-double-right" aria-hidden="true" />
          </PaginationLast>
        </PaginationList>
      </PaginationRoot>
    </template>

    <template v-else-if="mode === 'load-more'">
      <VuButton
        v-if="hasMore"
        class="scope-primary c8-filled"
        :label="state.queryingNext.value ? 'Loading...' : 'Load More'"
        :loading="state.queryingNext.value"
        @click="state.queryNext()"
      />
      <span v-else class="table-pagination-loaded">
        All {{ state.totalCount.value }} rows loaded
      </span>
    </template>
  </div>
</template>
