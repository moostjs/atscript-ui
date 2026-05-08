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

// TanStack's virtual window occasionally drops the very last item (or two)
// when the dataset just barely exceeds viewport+overscan — overscan extends
// only one direction at the boundary, leaving a tail gap roughly the size
// of the missing items. The resulting padding spacer is invisible to users
// but indistinguishable from a data row to E2E selectors like
// `tbody tr:has(td)`. Inline-render those tail items instead, but only when
// the gap is consistent with under-rendering (small `remaining`, gap not
// exceeding what the missing rows would naturally occupy). Genuine
// virtualization with large remaining counts and large gaps is left alone.
const tailFillCount = computed(() => {
  const items = virtualItems.value;
  if (items.length === 0) return 0;
  const last = items[items.length - 1]!;
  const remaining = props.options.length - 1 - last.index;
  if (remaining <= 0 || remaining > props.overscan) return 0;
  const gap = virtualizer.value.getTotalSize() - last.end;
  return gap <= (remaining + 1) * props.estimateSize ? remaining : 0;
});

const virtualizedItems = computed(() => {
  const items = virtualItems.value;
  const fill = tailFillCount.value;
  if (fill === 0) {
    return items.map((vItem) => ({
      item: props.options[vItem.index],
      index: vItem.index,
    }));
  }
  const result: Array<{ item: Record<string, unknown>; index: number }> = [];
  for (const vItem of items) {
    result.push({ item: props.options[vItem.index]!, index: vItem.index });
  }
  const start = items[items.length - 1]!.index + 1;
  for (let i = start; i < props.options.length; i++) {
    result.push({ item: props.options[i]!, index: i });
  }
  return result;
});

// Padding rows drive the total scrollable height for HTML table
// virtualization — `height` on `<tbody>` is not reliably honored in CSS table
// layout when rendered content is shorter than the virtual height. Skip
// either spacer when (a) no items are rendered yet (transient pre-mount), or
// (b) every item is already in the DOM (small dataset, or the tail-fill
// branch above filled the trailing gap).
const paddingTop = computed(() => {
  const items = virtualItems.value;
  if (items.length >= props.options.length) return 0;
  return items[0]?.start ?? 0;
});
const paddingBottom = computed(() => {
  const items = virtualItems.value;
  if (items.length === 0) return 0;
  if (items.length + tailFillCount.value >= props.options.length) return 0;
  return virtualizer.value.getTotalSize() - items[items.length - 1]!.end;
});

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
