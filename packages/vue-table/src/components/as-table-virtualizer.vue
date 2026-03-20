<script setup lang="ts">
import { computed, ref, type Ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";

const props = withDefaults(
  defineProps<{
    rows: Record<string, unknown>[];
    estimateSize?: number;
    overscan?: number;
  }>(),
  {
    estimateSize: 40,
    overscan: 5,
  },
);

const containerRef = ref<HTMLElement | null>(null) as Ref<HTMLElement | null>;

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.rows.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => props.estimateSize,
    overscan: props.overscan,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

defineExpose({ containerRef });
</script>

<template>
  <div
    ref="containerRef"
    class="as-table-scroll-container"
    style="overflow: auto; position: relative"
  >
    <slot
      :virtual-rows="virtualRows"
      :total-size="totalSize"
      :measure-element="virtualizer.measureElement"
    />
  </div>
</template>
