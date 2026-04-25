<script setup lang="ts">
import { computed, type Ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { useParentElement } from "@vueuse/core";
import { Primitive } from "reka-ui";

const props = withDefaults(
  defineProps<{
    options: Record<string, unknown>[];
    estimateSize?: number;
    overscan?: number;
    bypass?: boolean;
  }>(),
  {
    estimateSize: 40,
    overscan: 5,
  },
);

const parentEl = useParentElement() as Ref<HTMLElement>;

const virtualizer = useVirtualizer({
  get count() {
    return props.options.length;
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
    item: props.options[vItem.index],
  })),
);

const spaceBefore = computed(() => virtualItems.value[0]?.start ?? 0);
</script>

<template>
  <Primitive v-if="bypass">
    <slot v-for="item of options" v-bind="{ item, spaceBefore: undefined }"> </slot>
  </Primitive>
  <Primitive
    v-else
    :style="{
      height: `${virtualizer.getTotalSize()}px`,
    }"
  >
    <slot v-for="vItem of virtualizedItems" v-bind="vItem" :space-before> </slot>
    <tr />
  </Primitive>
</template>
