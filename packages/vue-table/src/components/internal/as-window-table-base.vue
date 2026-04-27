<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import type { ColumnDef } from "@atscript/ui";
import {
  clampTopIndex,
  filledFilterCount,
  reorderColumnNames,
  type ColumnReorderPosition,
} from "@atscript/ui-table";
import type { ColumnMenuConfig, SelectAllState } from "../../types";
import { useTableContext } from "../../composables/use-table-state";
import { useRafBatch } from "../../composables/use-raf-batch";
import { getCellValue } from "../../utils/get-cell-value";
import AsTableCellValue from "../defaults/as-table-cell-value.vue";
import AsTableHeader from "./as-table-header.vue";
import AsTableStatus from "./as-table-status.vue";
import AsWindowSkeletonRow from "./as-window-skeleton-row.vue";
import AsWindowScrollbar from "./as-window-scrollbar.vue";

type Row = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    /** Pixel height of one row. */
    rowHeight: number;
    /** Number of rows the viewport advances per wheel-tick. */
    wheelRowsPerTick?: number;
    columnMenu?: ColumnMenuConfig;
    reorderable?: boolean;
    resizable?: boolean;
    columnMinWidth?: number;
  }>(),
  {
    reorderable: true,
    resizable: true,
    columnMinWidth: 48,
    wheelRowsPerTick: 3,
  },
);

const emit = defineEmits<{
  (e: "row-click", row: Row, event: MouseEvent): void;
  (e: "row-dblclick", row: Row, event: MouseEvent): void;
  /**
   * Raw (uncapped) measurement of how many rows fit, plus the chrome height
   * that must surround them. The Tier-1 wrapper applies min/max-rows clamps
   * and writes container styles — this base does NOT own outer geometry.
   */
  (
    e: "viewport-metrics-change",
    metrics: { fits: number; rowHeightPx: number; chromePx: number },
  ): void;
}>();

const slots = useSlots();
const { state } = useTableContext();

const hasValue = computed(() => state.selectionMode !== "none");
const hasActiveFilters = computed(() => filledFilterCount(state.filters.value) > 0);

// Window mode never has a fully-known dataset, so "all" is never reachable.
const selectAllState = computed<SelectAllState | undefined>(() => {
  if (state.selectionMode !== "multi") return undefined;
  return state.selectedRows.value.length === 0 ? "none" : "some";
});

// Precomputed once per (columns, slots) change to avoid `slots[\`cell-${path}\`]`
// allocation per row × per render.
const cellSlotFlags = computed(() => {
  const out: Record<string, boolean> = {};
  for (const c of state.columns.value) out[c.path] = !!slots[`cell-${c.path}`];
  return out;
});

const rowStyle = computed(() => ({ height: `${props.rowHeight}px` }));

const visibleSlots = computed(() => {
  const viewport = state.viewportRowCount.value;
  if (viewport <= 0) return [];
  const total = state.totalCount.value;
  const count = Math.min(viewport, Math.max(total, 0));
  const top = state.topIndex.value;
  const rowValueFn = state.rowValueFn;
  const out: { s: number; row: Row | undefined; pk: unknown; errored: boolean }[] = [];
  for (let s = 0; s < count; s++) {
    const abs = top + s;
    const row = state.dataAt(abs);
    out.push({
      s,
      row,
      pk: row === undefined ? undefined : rowValueFn(row),
      errored: row === undefined && state.errorAt(abs) !== null,
    });
  }
  return out;
});

function clamp(n: number) {
  return clampTopIndex(n, state.totalCount.value, state.viewportRowCount.value);
}

// trackpad wheel events fire >120Hz; coalesce so planFetch + visibleSlots run once per frame.
let pendingTopIndex: number | null = null;
const topIndexBatch = useRafBatch<number>((next) => {
  pendingTopIndex = null;
  if (next !== state.topIndex.value) state.topIndex.value = next;
});

function scheduleTopIndex(next: number) {
  pendingTopIndex = next;
  topIndexBatch.schedule(next);
}

onBeforeUnmount(() => {
  state.viewportRowCount.value = 0;
});

function onWheel(event: WheelEvent) {
  event.preventDefault();
  const delta = Math.sign(event.deltaY) * props.wheelRowsPerTick;
  const target = pendingTopIndex ?? state.topIndex.value;
  scheduleTopIndex(clamp(target + delta));
}

function onKeydown(event: KeyboardEvent) {
  let next: number | null = null;
  switch (event.key) {
    case "ArrowDown":
      next = state.topIndex.value + 1;
      break;
    case "ArrowUp":
      next = state.topIndex.value - 1;
      break;
    case "PageDown":
      next = state.topIndex.value + state.viewportRowCount.value;
      break;
    case "PageUp":
      next = state.topIndex.value - state.viewportRowCount.value;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = state.totalCount.value;
      break;
  }
  if (next === null) return;
  event.preventDefault();
  scheduleTopIndex(clamp(next));
}

let touchStartY: number | null = null;
let touchStartTopIndex = 0;

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  if (!touch) return;
  touchStartY = touch.clientY;
  touchStartTopIndex = state.topIndex.value;
}

function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (touch === undefined || touchStartY === null) return;
  if (props.rowHeight <= 0) return;
  const delta = touchStartY - touch.clientY;
  const rowsDelta = Math.trunc(delta / props.rowHeight);
  state.topIndex.value = clamp(touchStartTopIndex + rowsDelta);
}

function onTouchEnd() {
  touchStartY = null;
}

const selectedSet = computed(() => new Set(state.selectedRows.value));
function isPkSelected(pk: unknown): boolean {
  return selectedSet.value.has(pk);
}

function onRowClick(row: Row, event: MouseEvent) {
  emit("row-click", row, event);
  if (state.selectionMode === "none") return;
  const pk = state.rowValueFn(row);
  if (state.selectionMode === "single") {
    state.selectedRows.value = [pk];
    return;
  }
  const idx = state.selectedRows.value.indexOf(pk);
  if (idx === -1) state.selectedRows.value = [...state.selectedRows.value, pk];
  else state.selectedRows.value = state.selectedRows.value.filter((v) => v !== pk);
}

function onRowDblClick(row: Row, event: MouseEvent) {
  emit("row-dblclick", row, event);
}

// 'some' deselects, 'none' selects what's currently in windowCache. 'all' is
// unreachable here since the dataset is unbounded.
function onSelectAllToggle(headerState: SelectAllState) {
  if (headerState === "none") {
    const pks: unknown[] = [];
    for (const row of state.windowCache.value.values()) pks.push(state.rowValueFn(row));
    state.selectedRows.value = pks;
  } else {
    state.selectedRows.value = [];
  }
}

function onSort(column: ColumnDef, direction: "asc" | "desc" | null) {
  const rest = state.sorters.value.filter((s) => s.field !== column.path);
  state.sorters.value = direction === null ? rest : [...rest, { field: column.path, direction }];
}

function onHide(column: ColumnDef) {
  state.columnNames.value = state.columnNames.value.filter((n) => n !== column.path);
}

function onFilter(column: ColumnDef) {
  state.openFilterDialog(column);
}

function onFiltersOff(column: ColumnDef) {
  state.removeFieldFilter(column.path);
}

function onResetWidth(column: ColumnDef) {
  state.resetColumnWidth(column.path);
}

function onReorder(fromPath: string, toPath: string, position: ColumnReorderPosition) {
  state.columnNames.value = reorderColumnNames(state.columnNames.value, fromPath, toPath, position);
}

function onClearFilters() {
  state.resetFilters();
  if (state.searchTerm.value) state.searchTerm.value = "";
}

// ── Viewport measurement ───────────────────────────────────────────────────
//
// The base owns its DOM, so it measures geometry directly via template refs
// instead of asking the wrapper to querySelector across the boundary.
// Emits raw `fits` (uncapped row count) + chrome + measured row stride; the
// Tier-1 wrapper applies its rows / minRows / maxRows constraints and
// writes container styles. This keeps min/max height policy at the user-facing
// surface where the props live, and DOM math in the renderer that owns the DOM.
const wrapperRef = ref<HTMLElement | null>(null);
const poolRef = ref<HTMLElement | null>(null);

let recomputeScheduled = false;
function scheduleRecompute() {
  if (recomputeScheduled) return;
  recomputeScheduled = true;
  void nextTick(() => {
    recomputeScheduled = false;
    recompute();
  });
}

function recompute() {
  const wrapper = wrapperRef.value;
  const tbody = poolRef.value;
  if (!wrapper) return;
  // wrapper.clientHeight excludes the horizontal scrollbar; offsetHeight
  // includes it.
  const wrapperClient = wrapper.clientHeight;
  const wrapperOffset = wrapper.offsetHeight;
  const hScrollbar = Math.max(0, wrapperOffset - wrapperClient);
  // Derive thead height as table.offsetHeight - tbody.offsetHeight when both
  // are measurable. This is more robust than reading `<thead>.offsetHeight`
  // directly, which can disagree with the actual layout (the row pool tbody
  // is what the rendered rows live in, so anchor everything to it).
  const tbodyHeight = tbody?.offsetHeight ?? 0;
  const table = tbody?.parentElement as HTMLTableElement | null;
  const tableHeight = table?.offsetHeight ?? 0;
  const theadHeight =
    table && tbody
      ? Math.max(0, tableHeight - tbodyHeight)
      : ((wrapper.querySelector("thead") as HTMLElement | null)?.offsetHeight ?? 0);
  const chromePx = theadHeight + hScrollbar;
  const usable = Math.max(0, wrapperClient - theadHeight);

  // `height` on `<tr>` is a *minimum* in CSS table layout — cell padding,
  // line-height, and borders can grow each row past `props.rowHeight`. If we
  // divide by the prop, we overcount and bottom rows clip. Measure the
  // ACTUAL rendered row stride from the tbody: average row height = tbody
  // height / row count. More robust than reading the first row's
  // `offsetHeight` (which can lie under `overflow: hidden`). `Math.ceil` is
  // a safety margin so an off-by-fraction can never overcount.
  const rowCount = tbody?.children.length ?? 0;
  const measuredRowHeight = rowCount > 0 && tbodyHeight > 0 ? Math.ceil(tbodyHeight / rowCount) : 0;
  const rowHeightPx = measuredRowHeight || props.rowHeight;
  const fits = Math.max(0, Math.floor(usable / rowHeightPx));

  emit("viewport-metrics-change", { fits, rowHeightPx, chromePx });
}

useResizeObserver(wrapperRef, scheduleRecompute);
useResizeObserver(poolRef, scheduleRecompute);

onMounted(() => {
  void nextTick(() => recompute());
});

// Recompute on signals that can change row count or chrome height without
// changing the wrapper's own size — row-height prop, column visibility
// (thead height), and total count (max scroll). The two ResizeObservers
// above already cover layout-driven causes (column widths changing
// scrollbar visibility, pool reflow on first paint).
watch(() => [props.rowHeight, state.columns.value, state.totalCount.value], scheduleRecompute);
</script>

<template>
  <div class="as-window-table-scroll-area">
    <div ref="wrapperRef" class="as-window-table-wrapper">
      <table class="as-table as-table-stretch">
        <AsTableHeader
          :columns="state.columns.value"
          :sorters="state.sorters.value"
          :filters="state.filters.value"
          :column-menu="columnMenu"
          :column-widths="state.columnWidths.value"
          :reorderable="reorderable"
          :resizable="resizable"
          :column-min-width="columnMinWidth"
          :has-select-column="hasValue"
          :select-all-state="selectAllState"
          :with-filler="true"
          :enable-auto-fit="true"
          @sort="onSort"
          @hide="onHide"
          @filter="onFilter"
          @filters-off="onFiltersOff"
          @reset-width="onResetWidth"
          @reorder="onReorder"
          @resize="state.setColumnWidth"
          @select-all-toggle="onSelectAllToggle"
        >
          <template v-for="col in state.columns.value" #[`header-${col.path}`]="scope">
            <slot :name="`header-${col.path}`" v-bind="scope" />
          </template>
        </AsTableHeader>
        <tbody
          ref="poolRef"
          class="as-window-row-pool"
          tabindex="0"
          @wheel="onWheel"
          @keydown="onKeydown"
          @touchstart="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        >
          <template v-for="slot in visibleSlots" :key="`slot-${slot.s}`">
            <tr
              v-if="slot.row !== undefined"
              class="as-window-data-row"
              :style="rowStyle"
              @click="onRowClick(slot.row as Row, $event)"
              @dblclick="onRowDblClick(slot.row as Row, $event)"
            >
              <td v-if="hasValue" class="as-td-select">
                <span
                  v-if="state.selectionMode === 'multi'"
                  class="as-table-checkbox"
                  role="checkbox"
                  tabindex="0"
                  :class="{ 'as-table-checkbox-checked': isPkSelected(slot.pk) }"
                  :aria-checked="isPkSelected(slot.pk) ? 'true' : 'false'"
                >
                  <span
                    v-if="isPkSelected(slot.pk)"
                    class="as-table-checkbox-tick"
                    aria-hidden="true"
                  />
                </span>
              </td>
              <template v-for="col in state.columns.value" :key="col.path">
                <td v-if="cellSlotFlags[col.path]">
                  <slot
                    :name="`cell-${col.path}`"
                    :row="slot.row"
                    :value="getCellValue(slot.row, col.path)"
                    :column="col"
                  />
                </td>
                <AsTableCellValue v-else :row="slot.row" :column="col" />
              </template>
              <td class="as-td-filler" />
            </tr>
            <AsWindowSkeletonRow
              v-else
              :columns="state.columns.value"
              :row-height="rowHeight"
              :has-select="hasValue"
              :errored="slot.errored"
            />
          </template>
        </tbody>
      </table>
      <!-- Error / empty placeholders render INSIDE the wrapper so they cover
           the empty pool body when there's nothing to show; suppressed during
           a `querying` refresh because the full-table overlay covers that case. -->
      <AsTableStatus
        :query-error="state.queryError.value"
        :is-empty="state.totalCount.value === 0"
        :querying="state.querying.value"
        :columns="state.columns.value"
        :search-term="state.searchTerm.value"
        :has-active-filters="hasActiveFilters"
        :on-clear-filters="onClearFilters"
        :on-retry="state.query"
      >
        <template #error="scope"><slot name="error" v-bind="scope" /></template>
        <template #empty="scope"><slot name="empty" v-bind="scope" /></template>
      </AsTableStatus>
    </div>
    <AsWindowScrollbar
      :top-index="state.topIndex.value"
      :viewport-row-count="state.viewportRowCount.value"
      :total-count="state.totalCount.value"
      @top-index-change="(v: number) => (state.topIndex.value = v)"
    />
  </div>
</template>
