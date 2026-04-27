<script setup lang="ts">
import { ref, watch } from "vue";
import { DEFAULT_ROW_HEIGHT_PX, clampTopIndex } from "@atscript/ui-table";
import type { ColumnMenuConfig, EnterAction, QueryErrorKind } from "../types";
import { useRegisterMainActionListener, useTableContext } from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
import AsWindowTableBase from "./internal/as-window-table-base.vue";

type Row = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    /** Pixel height of one row. Defaults to `DEFAULT_ROW_HEIGHT_PX`. */
    rowHeight?: number;
    /** Number of rows the viewport advances per wheel-tick. */
    wheelRowsPerTick?: number;
    /**
     * Force exactly N rows tall. Equivalent to setting both `min-rows` and
     * `max-rows` to N — overrides both when set. The table reserves N rows
     * worth of height even when empty.
     */
    rows?: number;
    /**
     * Minimum row count. The table is at least this tall even when empty
     * or when fewer rows would fit the available area.
     */
    minRows?: number;
    /**
     * Maximum row count. The table caps at this many rows tall even if the
     * available area would fit more. Useful for value-help dialogs.
     */
    maxRows?: number;
    columnMenu?: ColumnMenuConfig;
    /** Allow header drag-and-drop column reorder. Default true. */
    reorderable?: boolean;
    /** Allow header drag-resize. Default true. */
    resizable?: boolean;
    /** Pixel floor for the resize clamp. Default 48. */
    columnMinWidth?: number;
    /**
     * Override Enter-key semantics. Default `"main-action"`. Pass
     * `"toggle-select"` to make Enter mirror Space (pick/unpick the active
     * row) — used by value-help dialog tables where Enter shouldn't fire a
     * main action.
     */
    enterAction?: EnterAction;
  }>(),
  {
    rowHeight: DEFAULT_ROW_HEIGHT_PX,
    // Native browsers report `deltaY` in already-quantized line/pixel units;
    // multiplying further makes scroll feel runaway.
    wheelRowsPerTick: 1,
    reorderable: true,
    resizable: true,
    columnMinWidth: 48,
  },
);

const emit = defineEmits<{
  (e: "row-click", row: Row, event: MouseEvent): void;
  (e: "row-dblclick", row: Row, event: MouseEvent): void;
  (e: "main-action", row: Row, absIndex: number, event: KeyboardEvent | MouseEvent): void;
  /**
   * Fired whenever ANY fetch fails — initial load, refresh, load-more, or
   * a per-block scroll fetch. The `kind` arg disambiguates so consumers
   * can format toasts differently per source. Sourced from
   * `state.lastError`; one emit per new error.
   */
  (e: "error", error: Error, kind: QueryErrorKind): void;
}>();

const { state } = useTableContext();

useRegisterMainActionListener(
  state,
  (req) => emit("main-action", req.row, req.absIndex, req.event),
  useHasEmitListener("onMainAction"),
);

const containerRef = ref<HTMLElement | null>(null);

// Apply user-facing rows / minRows / maxRows constraints to the metrics
// reported by the base, then write through to state + container styles.
function onMetrics({
  fits,
  rowHeightPx,
  chromePx,
}: {
  fits: number;
  rowHeightPx: number;
  chromePx: number;
}) {
  const minR = props.rows ?? props.minRows;
  const maxR = props.rows ?? props.maxRows;
  let target = fits;
  if (minR !== undefined && target < minR) target = minR;
  if (maxR !== undefined && target > maxR) target = maxR;
  state.viewportRowCount.value = target;
  const clamped = clampTopIndex(state.topIndex.value, state.totalCount.value, target);
  if (clamped !== state.topIndex.value) state.topIndex.value = clamped;

  const container = containerRef.value;
  if (!container) return;
  const px = (n: number) => `${n * rowHeightPx + chromePx}px`;
  container.style.minHeight = minR !== undefined ? px(minR) : "";
  container.style.maxHeight = maxR !== undefined ? px(maxR) : "";
}

// Re-emit any fetch error (initial / query / queryNext / loadRange) so
// consumers can pipe into toasts. `lastError` is only set on failures; a
// successful retry does NOT clear it, so the watcher only fires when a NEW
// failure happens (each set creates a new `{error, kind}` object).
watch(
  () => state.lastError.value,
  (info) => {
    if (info) emit("error", info.error, info.kind);
  },
);
</script>

<template>
  <div ref="containerRef" class="as-table-outer-wrap">
    <AsWindowTableBase
      :row-height="rowHeight"
      :wheel-rows-per-tick="wheelRowsPerTick"
      :column-menu="columnMenu"
      :reorderable="reorderable"
      :resizable="resizable"
      :column-min-width="columnMinWidth"
      :enter-action="enterAction"
      @row-click="(row: Row, ev: MouseEvent) => emit('row-click', row, ev)"
      @row-dblclick="(row: Row, ev: MouseEvent) => emit('row-dblclick', row, ev)"
      @viewport-metrics-change="onMetrics"
    >
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </AsWindowTableBase>
    <div v-if="state.querying.value" class="as-table-query-overlay">
      <slot name="query-loading">
        <span class="as-table-query-overlay-icon" aria-hidden="true" />
      </slot>
    </div>
  </div>
</template>
