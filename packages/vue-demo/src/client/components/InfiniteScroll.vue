<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useInfiniteScroll } from "@vueuse/core";
import { useTableContext } from "@atscript/vue-table";

/**
 * Infinite-scroll bridge for `<AsTable>`. Calls `state.queryNext()` (the
 * framework's append-style block fetcher; rows accumulate in
 * `state.results` via `walkForwardAbsorb`) when the table's scroll
 * container nears its bottom.
 *
 * Pairs with a paginated table whose `limit` matches `DEFAULT_BLOCK_SIZE`
 * (100). With `limit !== blockSize`, the initial page lands as a partial
 * block and `queryNext` re-fetches block 0 alongside block 1. Demo wires
 * `audit_log_infinite` with `limit: 100`.
 */
const props = withDefaults(
  defineProps<{
    /** Wrapper element containing the `<AsTable>` (e.g. a `useTemplateRef` value). */
    container: HTMLElement | null;
    /** Trigger queryNext when within this many pixels of the bottom. */
    threshold?: number;
  }>(),
  { threshold: 200 },
);

const { state } = useTableContext();

const hasMore = computed(() => state.loadedCount.value < state.totalCount.value);
const scrollEl = ref<HTMLElement | null>(null);

// Resolve `<AsTable>`'s scroll container under the wrapper passed in by
// the consumer (instead of `document.querySelector`) so multiple tables
// on a page each get their own listener.
watch(
  () => props.container,
  (wrap) => {
    scrollEl.value = wrap?.querySelector<HTMLElement>(".as-table-scroll-container") ?? null;
  },
  { immediate: true },
);

useInfiniteScroll(scrollEl, () => state.queryNext(), {
  distance: props.threshold,
  canLoadMore: () => hasMore.value && !state.queryingNext.value,
});
</script>

<template>
  <div
    v-if="state.queryingNext.value || (!hasMore && state.totalCount.value > 0)"
    class="infinite-scroll-status flex items-center justify-center gap-$s py-$s text-callout text-current/60"
    :data-state="state.queryingNext.value ? 'loading' : 'done'"
  >
    <span v-if="state.queryingNext.value" class="flex items-center gap-$xs">
      <span class="i-ph:circle-notch animate-spin" aria-hidden="true" />
      <span>Loading more…</span>
    </span>
    <span v-else class="infinite-scroll-loaded">
      All {{ state.totalCount.value }} rows loaded
    </span>
  </div>
</template>
