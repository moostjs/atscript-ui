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
    /**
     * Pixel offset reserved at the top of the scroll container for sticky
     * chrome (e.g. `<thead>`). When set, `scrollToIndex` lands rows below
     * that band instead of behind it. The watcher passes `theadHeight`
     * here.
     */
    scrollPaddingStart?: number;
  }>(),
  {
    estimateSize: 40,
    overscan: 5,
    scrollPaddingStart: 0,
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
  get scrollPaddingStart() {
    return props.scrollPaddingStart;
  },
});

const virtualItems = computed(() => virtualizer.value.getVirtualItems());

const virtualizedItems = computed(() =>
  virtualItems.value.map((vItem) => ({
    item: props.options[vItem.index],
    index: vItem.index,
  })),
);

// Padding rows are the correct approach for HTML table virtualization.
// `height` on `<tbody>` is not reliably honored in CSS table layout when the
// actual rendered content is shorter (e.g. 42 visible rows vs 3750 total),
// so spacer <tr> elements drive the total scrollable height instead.
const paddingTop = computed(() => virtualItems.value[0]?.start ?? 0);
const paddingBottom = computed(
  () => virtualizer.value.getTotalSize() - (virtualItems.value.at(-1)?.end ?? 0),
);

defineExpose({
  /**
   * Scroll the parent container so row `index` is visible. No-op when
   * `bypass` is true (every row already in DOM — use `scrollIntoView` on the
   * `<tr>` directly). The active-row → scroll watcher in `AsTableBase` calls
   * this for off-screen virtualized rows where `getElementById` returns
   * `null`.
   */
  scrollToIndex(index: number, opts?: { align?: "auto" | "start" | "center" | "end" }) {
    if (props.bypass) return;
    virtualizer.value.scrollToIndex(index, { align: opts?.align ?? "auto" });
  },
});
</script>

<template>
  <Primitive v-if="bypass">
    <slot
      v-for="(item, index) of options"
      :key="index"
      v-bind="{ item, index, spaceBefore: undefined }"
    >
    </slot>
  </Primitive>
  <Primitive v-else>
    <tr v-if="paddingTop > 0" aria-hidden="true">
      <td :style="{ height: `${paddingTop}px`, padding: '0', border: 'none' }" />
    </tr>
    <slot
      v-for="vItem of virtualizedItems"
      :key="vItem.index"
      v-bind="{ item: vItem.item, index: vItem.index, spaceBefore: undefined }"
    />
    <tr v-if="paddingBottom > 0" aria-hidden="true">
      <td :style="{ height: `${paddingBottom}px`, padding: '0', border: 'none' }" />
    </tr>
  </Primitive>
</template>
