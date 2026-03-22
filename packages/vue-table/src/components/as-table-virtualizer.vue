<script setup lang="ts">
import { computed, type Ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { useParentElement } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    count: number;
    estimateSize?: number;
    overscan?: number;
  }>(),
  {
    estimateSize: 40,
    overscan: 5,
  },
);

const parentEl = useParentElement() as Ref<HTMLElement>;

const virtualizer = useVirtualizer({
  get count() {
    return props.count;
  },
  estimateSize() {
    return props.estimateSize;
  },
  getScrollElement() {
    return parentEl.value?.closest("[data-virtual-scroll]") as HTMLElement | null;
  },
  overscan: props.overscan,
});

const virtualItems = computed(() => virtualizer.value.getVirtualItems());

const virtualizedItems = computed(() =>
  virtualItems.value.map((vItem) => ({
    index: vItem.index,
  })),
);

const spaceBefore = computed(() => virtualItems.value[0]?.start ?? 0);
</script>

<template>
  <tbody :style="{ height: `${virtualizer.getTotalSize()}px` }">
    <slot v-for="vItem in virtualizedItems" :key="vItem.index" v-bind="vItem" :space-before />
    <tr />
  </tbody>
</template>
