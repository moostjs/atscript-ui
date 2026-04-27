<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, useSlots, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import type { ColumnDef, SortControl } from "@atscript/ui";
import {
  filledFilterCount,
  DEFAULT_ROW_HEIGHT_PX,
  type ColumnReorderPosition,
  type ColumnWidthsMap,
  type FieldFilters,
} from "@atscript/ui-table";
import type { ColumnMenuConfig, SelectAllState } from "../../types";
import { ComboboxItem, ComboboxItemIndicator, ListboxItem, ListboxItemIndicator } from "reka-ui";
import { getCellValue } from "../../utils/get-cell-value";
import { useTableContextOptional } from "../../composables/use-table-state";
import AsTableCellValue from "../defaults/as-table-cell-value.vue";
import AsTableHeader from "./as-table-header.vue";
import AsTableStatus from "./as-table-status.vue";
import AsTableVirtualizer from "./as-table-virtualizer.vue";

type RenderMode = "standalone" | "combobox" | "listbox";

const props = withDefaults(
  defineProps<{
    columns: ColumnDef[];
    rows: Record<string, unknown>[];
    sorters: SortControl[];
    /** Currently selected row values (for header checkbox state). */
    selectedRows?: unknown[];
    /** Selection mode for standalone (non-combobox) rendering. */
    select?: "none" | "single" | "multi";
    /**
     * Row-rendering branch:
     * - `"standalone"` (default): plain `<tr>` driven by the custom keyboard
     *   nav layer; selection writes go to `state.selectedRows` directly.
     * - `"combobox"`: rows render as Reka `ComboboxItem` (used by the filter
     *   input dropdown). Parent Reka `ComboboxRoot` owns ARIA + keyboard.
     * - `"listbox"`: rows render as Reka `ListboxItem` (used by the enum
     *   value-help dialog table). Parent Reka `ListboxRoot` owns ARIA + keyboard.
     */
    renderMode?: RenderMode;
    /** Extract unique value from a row (required when select !== 'none' or renderMode is combobox/listbox). */
    rowValueFn?: (row: Record<string, unknown>) => unknown;
    querying?: boolean;
    queryError?: Error | null;
    onRetry?: () => void;
    stickyHeader?: boolean;
    virtualRowHeight?: number;
    virtualOverscan?: number;
    filters?: FieldFilters;
    /** Top-level search term (used by the default empty state body). */
    searchTerm?: string;
    /** Invoked by the default empty-state "Clear filters" shortcut. */
    onClearFilters?: () => void;
    columnMenu?: ColumnMenuConfig;
    stretch?: boolean;
    /** Allow header drag-and-drop column reorder. Default true. */
    reorderable?: boolean;
    /** Allow header drag-resize. Default true. */
    resizable?: boolean;
    /** Pixel floor for the resize clamp. Default 48. */
    columnMinWidth?: number;
    /**
     * Per-column widths keyed by column path. Each entry: `{ w, d }`. Always
     * fully populated for every column once the parent has seeded defaults.
     */
    columnWidths?: ColumnWidthsMap;
  }>(),
  {
    select: "none",
    renderMode: "standalone",
    stickyHeader: true,
    virtualOverscan: 5,
    stretch: true,
    reorderable: true,
    resizable: true,
    columnMinWidth: 48,
    columnWidths: () => ({}),
  },
);

const ctx = useTableContextOptional();

const isStandalone = computed(() => props.renderMode === "standalone");
const isCombobox = computed(() => props.renderMode === "combobox");
const isListbox = computed(() => props.renderMode === "listbox");
const isRekaWrapped = computed(() => isCombobox.value || isListbox.value);

const hasValue = computed(() => isRekaWrapped.value || props.select !== "none");

const hasActiveFilters = computed(() =>
  props.filters ? filledFilterCount(props.filters) > 0 : false,
);

const showSelectAllCheckbox = computed(
  () => isStandalone.value && props.select === "multi" && !!props.selectedRows,
);

const selectAllState = computed<SelectAllState | undefined>(() => {
  if (!showSelectAllCheckbox.value) return undefined;
  const sel = props.selectedRows ?? [];
  if (sel.length === 0) return "none";
  if (sel.length === props.rows.length && props.rows.length > 0) return "all";
  return "some";
});

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
  (e: "filter", column: ColumnDef): void;
  (e: "filters-off", column: ColumnDef): void;
  (e: "row-click", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "row-dblclick", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "select-all"): void;
  (e: "deselect-all"): void;
  (e: "reorder", fromPath: string, toPath: string, position: ColumnReorderPosition): void;
  (e: "resize", path: string, width: string): void;
  /** Reset this column's width back to its default (`d`). */
  (e: "reset-width", column: ColumnDef): void;
}>();

const slots = useSlots();

const cellSlotFlags = computed(() => {
  const out: Record<string, boolean> = {};
  for (const c of props.columns) out[c.path] = !!slots[`cell-${c.path}`];
  return out;
});

function isPkSelected(row: Record<string, unknown>): boolean {
  if (!ctx || !props.rowValueFn) return false;
  return ctx.state.isPkSelected(props.rowValueFn(row));
}

function ariaSelectedFor(row: Record<string, unknown>): "true" | "false" | undefined {
  if (props.select === "none") return undefined;
  return isPkSelected(row) ? "true" : "false";
}

function onRowClick(row: Record<string, unknown>, event: MouseEvent, index: number) {
  emit("row-click", row, event);
  if (!isStandalone.value) return;
  if (ctx) ctx.state.setActive(index);
  if (props.select === "none") {
    if (ctx) ctx.state.requestMainAction(event);
    return;
  }
  if (!ctx) return;
  ctx.state.toggleActiveSelection();
}

function onRowDblClick(row: Record<string, unknown>, event: MouseEvent, index: number) {
  emit("row-dblclick", row, event);
  if (!isStandalone.value) return;
  if (props.select === "single" || props.select === "multi") {
    if (!ctx) return;
    ctx.state.setActive(index);
    ctx.state.requestMainAction(event);
  }
}

function onSelectAllToggle(state: SelectAllState) {
  // Tri-state semantics: only fully-checked deselects; partial/empty selects all.
  if (state === "all") emit("deselect-all");
  else emit("select-all");
}

function onTbodyKeydown(event: KeyboardEvent) {
  if (!isStandalone.value || !ctx) return;
  ctx.state.handleNavKey(event);
}

const scrollContainerRef = ref<HTMLElement | null>(null);

// Sticky-thead-aware scroll-into-view. Native `scrollIntoView({block:
// "nearest"})` ignores `position: sticky` siblings — the row sits behind the
// sticky `<thead>` while its bbox overlaps the container, so the browser
// refuses to scroll. Virtualized path uses direct scrollTop math to avoid the
// scrollToIndex→bbox-align feedback loop that flickers when tanstack re-mounts
// rows mid-scroll. Non-virtualized path can rely on bbox since every row is
// already in DOM.
function alignActiveRow(idx: number) {
  if (!ctx) return;
  const container = scrollContainerRef.value;
  if (!container) return;
  const thead = container.querySelector("thead") as HTMLElement | null;
  const theadHeight = thead?.offsetHeight ?? 0;
  const rowHeight = props.virtualRowHeight;

  if (rowHeight) {
    const rowTop = theadHeight + idx * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const visibleTop = container.scrollTop + theadHeight;
    const visibleBottom = container.scrollTop + container.clientHeight;
    if (rowTop < visibleTop) {
      container.scrollTop = rowTop - theadHeight;
    } else if (rowBottom > visibleBottom) {
      container.scrollTop = rowBottom - container.clientHeight;
    }
    return;
  }

  const el = document.getElementById(ctx.state.rowId(idx));
  if (!el) return;
  const containerRect = container.getBoundingClientRect();
  const rowRect = el.getBoundingClientRect();
  const stickyTop = containerRect.top + theadHeight;
  if (rowRect.top < stickyTop) {
    container.scrollTop -= stickyTop - rowRect.top;
  } else if (rowRect.bottom > containerRect.bottom) {
    container.scrollTop += rowRect.bottom - containerRect.bottom;
  }
}

function recomputeViewportRows() {
  if (!isStandalone.value || !ctx) return;
  const container = scrollContainerRef.value;
  if (!container) return;
  const rowHeight = props.virtualRowHeight ?? DEFAULT_ROW_HEIGHT_PX;
  if (rowHeight <= 0) return;
  const headerHeight = (container.querySelector("thead") as HTMLElement | null)?.offsetHeight ?? 0;
  const usable = Math.max(0, container.clientHeight - headerHeight);
  const fits = Math.max(0, Math.floor(usable / rowHeight));
  if (ctx.state.navViewportRowCount.value !== fits) {
    ctx.state.navViewportRowCount.value = fits;
  }
}

if (ctx) {
  // rAF-defer the scrollTop write so virtualizer re-mount + sticky thead
  // re-paint settle first, otherwise sub-pixel bbox drift triggers
  // a re-measure→re-scroll loop.
  let scrollFrame = 0;
  let pendingActiveIdx = -1;
  function scheduleAlign(idx: number) {
    pendingActiveIdx = idx;
    if (scrollFrame !== 0) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const i = pendingActiveIdx;
      pendingActiveIdx = -1;
      if (i >= 0) alignActiveRow(i);
    });
  }
  watch(
    () => ctx.state.activeIndex.value,
    (idx) => {
      if (!isStandalone.value || idx < 0) return;
      scheduleAlign(idx);
    },
    { flush: "post" },
  );

  useResizeObserver(scrollContainerRef, recomputeViewportRows);
  onMounted(() => void nextTick(recomputeViewportRows));
  watch(() => props.virtualRowHeight, recomputeViewportRows);
  watch(
    () => props.columns,
    () => void nextTick(recomputeViewportRows),
  );
  onScopeDispose(() => {
    if (scrollFrame !== 0) {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
    }
  });
}

const ariaRowCount = computed(() => {
  if (!isStandalone.value || !ctx) return undefined;
  return ctx.state.totalCount.value + 1;
});

const ariaActiveDescendant = computed(() => {
  if (!isStandalone.value || !ctx) return undefined;
  const idx = ctx.state.activeIndex.value;
  if (idx < 0) return "";
  return ctx.state.rowId(idx);
});

function rowIdFor(index: number): string | undefined {
  if (!isStandalone.value || !ctx) return undefined;
  return ctx.state.rowId(index);
}

function isActiveRow(index: number): boolean {
  if (!isStandalone.value || !ctx) return false;
  return ctx.state.activeIndex.value === index;
}
</script>

<template>
  <!--
    Always render the table + header so filter/sort/hide menus stay reachable
    even when rows are empty or the last query errored. The empty/error block
    renders AFTER </table> (but inside the scroll container) so its width is
    bound to the container, not the table's intrinsic fit-content width.
  -->
  <div ref="scrollContainerRef" class="as-table-scroll-container" data-virtual-scroll>
    <table
      class="as-table"
      :class="{
        'as-table-sticky': stickyHeader,
        'as-table-stretch': stretch,
      }"
      :role="isStandalone ? 'grid' : undefined"
      :aria-rowcount="ariaRowCount"
      :aria-multiselectable="isStandalone && select === 'multi' ? 'true' : undefined"
    >
      <AsTableHeader
        :columns="columns"
        :sorters="sorters"
        :filters="filters"
        :column-menu="columnMenu"
        :column-widths="columnWidths"
        :reorderable="reorderable"
        :resizable="resizable"
        :column-min-width="columnMinWidth"
        :has-select-column="hasValue"
        :select-all-state="selectAllState"
        :with-filler="stretch"
        :enable-auto-fit="true"
        :aria-rowindex="isStandalone ? 1 : undefined"
        @sort="(c, d) => emit('sort', c, d)"
        @hide="(c) => emit('hide', c)"
        @filter="(c) => emit('filter', c)"
        @filters-off="(c) => emit('filters-off', c)"
        @reset-width="(c) => emit('reset-width', c)"
        @reorder="(f, t, p) => emit('reorder', f, t, p)"
        @resize="(p, w) => emit('resize', p, w)"
        @select-all-toggle="onSelectAllToggle"
      >
        <template v-for="col in columns" #[`header-${col.path}`]="scope">
          <slot :name="`header-${col.path}`" v-bind="scope" />
        </template>
      </AsTableHeader>

      <!-- Combobox / listbox branches: rows render as Reka items. -->
      <template v-if="isRekaWrapped && !queryError">
        <AsTableVirtualizer
          :options="rows"
          :estimate-size="virtualRowHeight"
          :overscan="virtualOverscan"
          :bypass="!virtualRowHeight"
          as="tbody"
        >
          <template #default="{ item, spaceBefore }">
            <component
              :is="isCombobox ? ComboboxItem : ListboxItem"
              as="tr"
              :value="rowValueFn ? rowValueFn(item) : undefined"
              :style="{
                height: virtualRowHeight ? `${virtualRowHeight}px` : undefined,
                transform: spaceBefore ? `translateY(${spaceBefore}px)` : undefined,
              }"
              @click="emit('row-click', item, $event)"
              @dblclick="emit('row-dblclick', item, $event)"
            >
              <td v-if="hasValue" class="as-td-select">
                <span class="as-table-checkbox">
                  <component
                    :is="isCombobox ? ComboboxItemIndicator : ListboxItemIndicator"
                    class="as-table-checkbox-tick"
                    aria-hidden="true"
                  />
                </span>
              </td>
              <template v-for="col in columns" :key="col.path">
                <td v-if="cellSlotFlags[col.path]">
                  <slot
                    :name="`cell-${col.path}`"
                    :row="item"
                    :value="getCellValue(item, col.path)"
                    :column="col"
                  />
                </td>
                <AsTableCellValue v-else :row="item" :column="col" />
              </template>
              <td v-if="stretch" class="as-td-filler" />
            </component>
          </template>
        </AsTableVirtualizer>
      </template>

      <!-- Standalone branch — plain rows + custom keyboard nav, ARIA grid. -->
      <AsTableVirtualizer
        v-else-if="isStandalone && !queryError"
        :options="rows"
        :estimate-size="virtualRowHeight"
        :overscan="virtualOverscan"
        :bypass="!virtualRowHeight"
        as="tbody"
        :tabindex="0"
        :aria-activedescendant="ariaActiveDescendant"
        @keydown="onTbodyKeydown"
      >
        <template #default="{ item, index, spaceBefore }">
          <tr
            :id="rowIdFor(index)"
            :role="'row'"
            :aria-rowindex="index + 2"
            :aria-selected="ariaSelectedFor(item)"
            :class="{ 'as-table-row-active': isActiveRow(index) }"
            :style="{
              height: virtualRowHeight ? `${virtualRowHeight}px` : undefined,
              transform: spaceBefore ? `translateY(${spaceBefore}px)` : undefined,
            }"
            @click="onRowClick(item, $event, index)"
            @dblclick="onRowDblClick(item, $event, index)"
          >
            <td v-if="hasValue" class="as-td-select" role="gridcell">
              <span
                class="as-table-checkbox"
                :class="{ 'as-table-checkbox-checked': isPkSelected(item) }"
              >
                <span v-if="isPkSelected(item)" class="as-table-checkbox-tick" aria-hidden="true" />
              </span>
            </td>
            <template v-for="col in columns" :key="col.path">
              <td v-if="cellSlotFlags[col.path]" role="gridcell">
                <slot
                  :name="`cell-${col.path}`"
                  :row="item"
                  :value="getCellValue(item, col.path)"
                  :column="col"
                />
              </td>
              <AsTableCellValue v-else :row="item" :column="col" />
            </template>
            <td v-if="stretch" class="as-td-filler" role="gridcell" />
          </tr>
        </template>
      </AsTableVirtualizer>
    </table>
    <AsTableStatus
      :query-error="queryError"
      :is-empty="rows.length === 0"
      :querying="!!querying"
      :columns="columns"
      :search-term="searchTerm"
      :has-active-filters="hasActiveFilters"
      :on-clear-filters="onClearFilters"
      :on-retry="onRetry"
    >
      <template #error="scope"><slot name="error" v-bind="scope" /></template>
      <template #empty="scope"><slot name="empty" v-bind="scope" /></template>
    </AsTableStatus>
    <slot name="last-row" />
  </div>
</template>
