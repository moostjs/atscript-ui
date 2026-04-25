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

const { state } = useTableContext();

const currentPage = computed({
  get: () => state.pagination.value.page,
  set: (page) => {
    state.pagination.value = { ...state.pagination.value, page };
  },
});

const itemsPerPage = computed({
  get: () => state.pagination.value.itemsPerPage,
  set: (value) => {
    state.pagination.value = { page: 1, itemsPerPage: value };
  },
});

const sizeOptions = [10, 25, 50, 100];
</script>

<template>
  <div class="table-pagination">
    <label class="flex items-center gap-$xs text-callout text-current/60">
      <span>Rows per page</span>
      <select
        class="i8-filled h-fingertip-s px-$xs rounded-base border-1 layer-0 cursor-pointer"
        :value="itemsPerPage"
        @change="itemsPerPage = Number(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="n in sizeOptions" :key="n" :value="n">{{ n }}</option>
      </select>
    </label>
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
        <PaginationFirst class="table-pagination-btn" aria-label="First page">
          <span class="i-ph:caret-double-left" aria-hidden="true" />
        </PaginationFirst>
        <PaginationPrev class="table-pagination-btn" aria-label="Previous page">
          <span class="i-ph:caret-left" aria-hidden="true" />
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
            <span class="i-ph:dots-three" aria-hidden="true" />
          </PaginationEllipsis>
        </template>
        <PaginationNext class="table-pagination-btn" aria-label="Next page">
          <span class="i-ph:caret-right" aria-hidden="true" />
        </PaginationNext>
        <PaginationLast class="table-pagination-btn" aria-label="Last page">
          <span class="i-ph:caret-double-right" aria-hidden="true" />
        </PaginationLast>
      </PaginationList>
    </PaginationRoot>
  </div>
</template>
