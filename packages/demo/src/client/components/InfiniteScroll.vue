<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useInfiniteScroll } from "@vueuse/core";
import { useTableContext } from "@atscript/vue-table";

const props = withDefaults(
  defineProps<{
    /** Trigger queryNext when the scroll position reaches within this many pixels of the bottom. */
    threshold?: number;
  }>(),
  { threshold: 200 },
);

const { state } = useTableContext();

const hasMore = computed(() => state.loadedCount.value < state.totalCount.value);
const scrollEl = ref<HTMLElement | null>(null);

// AsTable mounts its scroll container on the next tick — wait one frame.
onMounted(() => {
  requestAnimationFrame(() => {
    scrollEl.value = document.querySelector<HTMLElement>("[data-virtual-scroll]");
  });
});

useInfiniteScroll(scrollEl, () => state.queryNext(), {
  distance: props.threshold,
  canLoadMore: () => hasMore.value && !state.queryingNext.value,
});
</script>

<template>
  <div
    v-if="state.queryingNext.value || !hasMore"
    class="flex items-center justify-center gap-$s py-$s text-callout text-current/60"
  >
    <span v-if="state.queryingNext.value" class="flex items-center gap-$xs">
      <span class="i-ph:circle-notch animate-spin" aria-hidden="true" />
      Loading more…
    </span>
    <span v-else class="table-pagination-loaded">
      All {{ state.totalCount.value }} rows loaded
    </span>
  </div>
</template>
