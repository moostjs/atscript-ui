<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, ref } from "vue";
import { clampTopIndex } from "@atscript/ui-table";
import { useRafBatch } from "../../composables/use-raf-batch";

const props = withDefaults(
  defineProps<{
    topIndex: number;
    viewportRowCount: number;
    totalCount: number;
    thumbMinHeight?: number;
  }>(),
  { thumbMinHeight: 24 },
);

const emit = defineEmits<{
  (e: "top-index-change", value: number): void;
}>();

const trackEl = ref<HTMLElement | null>(null);
const { height: trackHeight } = useElementSize(trackEl);
const dragging = ref(false);

let dragStartY = 0;
let dragStartTopIndex = 0;
let activePointerId: number | null = null;

const maxIndex = computed(() => Math.max(0, props.totalCount - props.viewportRowCount));

const visible = computed(() => maxIndex.value > 0);

const thumbHeight = computed(() => {
  if (props.totalCount <= 0 || trackHeight.value <= 0) return props.thumbMinHeight;
  const ideal = (props.viewportRowCount / props.totalCount) * trackHeight.value;
  return Math.max(props.thumbMinHeight, ideal);
});

const thumbY = computed(() => {
  if (maxIndex.value <= 0 || trackHeight.value <= 0) return 0;
  return (props.topIndex / maxIndex.value) * (trackHeight.value - thumbHeight.value);
});

function clamp(n: number) {
  return clampTopIndex(n, props.totalCount, props.viewportRowCount);
}

// pointermove can fire >120Hz; coalesce so the viewport watcher doesn't run
// planFetch + re-render per native event.
const topIndexBatch = useRafBatch<number>((next) => {
  if (next !== props.topIndex) emit("top-index-change", next);
});

function onThumbPointerDown(event: PointerEvent) {
  event.preventDefault();
  dragging.value = true;
  dragStartY = event.clientY;
  dragStartTopIndex = props.topIndex;
  activePointerId = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onThumbPointerMove(event: PointerEvent) {
  if (!dragging.value) return;
  const span = trackHeight.value - thumbHeight.value;
  if (span <= 0) return;
  const delta = event.clientY - dragStartY;
  const next = Math.round(dragStartTopIndex + (delta * maxIndex.value) / span);
  topIndexBatch.schedule(clamp(next));
}

function endDrag(event?: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  if (event && activePointerId !== null) {
    (event.currentTarget as HTMLElement).releasePointerCapture?.(activePointerId);
  }
  activePointerId = null;
}

function onTrackClick(event: MouseEvent) {
  if (dragging.value) return;
  const rect = trackEl.value?.getBoundingClientRect();
  if (!rect) return;
  const clickY = event.clientY - rect.top;
  const thumbCenter = thumbY.value + thumbHeight.value / 2;
  const direction = clickY < thumbCenter ? -1 : 1;
  emit("top-index-change", clamp(props.topIndex + direction * props.viewportRowCount));
}
</script>

<template>
  <div v-if="visible" class="as-window-scrollbar">
    <div
      ref="trackEl"
      class="as-window-scrollbar-track"
      role="scrollbar"
      aria-orientation="vertical"
      @click="onTrackClick"
    >
      <div
        class="as-window-scrollbar-thumb"
        :data-active="dragging || undefined"
        :style="{ height: `${thumbHeight}px`, top: `${thumbY}px` }"
        @pointerdown="onThumbPointerDown"
        @pointermove="onThumbPointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      />
    </div>
  </div>
</template>
