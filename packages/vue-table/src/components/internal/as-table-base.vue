<script setup lang="ts">
import { computed, ref, useSlots } from "vue";
import type { ColumnDef, SortControl } from "@atscript/ui";
import {
  filledFilterCount,
  type ColumnReorderPosition,
  type ColumnWidthsMap,
  type FieldFilters,
} from "@atscript/ui-table";
import type { ColumnMenuConfig } from "../../types";
import {
  ComboboxItem,
  ComboboxItemIndicator,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  Primitive,
} from "reka-ui";
import { getCellValue } from "../../utils/get-cell-value";
import AsTableHeaderCell from "../defaults/as-table-header-cell.vue";
import AsTableCellValue from "../defaults/as-table-cell-value.vue";
import AsTableVirtualizer from "./as-table-virtualizer.vue";

const props = withDefaults(
  defineProps<{
    columns: ColumnDef[];
    rows: Record<string, unknown>[];
    sorters: SortControl[];
    /** Currently selected row values (for header checkbox state). */
    selectedRows?: unknown[];
    /** Selection mode for standalone (non-combobox) rendering. */
    select?: "none" | "single" | "multi";
    /** When true, rows render as ComboboxItem (must be inside a ComboboxRoot). */
    asCombobox?: boolean;
    /** Extract unique value from a row (required when select !== 'none' or asCombobox is true). */
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
    stickyHeader: true,
    virtualOverscan: 5,
    stretch: true,
    reorderable: true,
    resizable: true,
    columnMinWidth: 48,
    columnWidths: () => ({}),
  },
);

const hasValue = computed(() => props.asCombobox || props.select !== "none");

const hasActiveFilters = computed(() =>
  props.filters ? filledFilterCount(props.filters) > 0 : false,
);

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

/** Map of column path → current sort direction for fast lookup in header cells. */
const sortMap = computed(() => {
  const map: Record<string, "asc" | "desc"> = {};
  for (const s of props.sorters) {
    map[s.field] = s.direction;
  }
  return map;
});

function hasCellSlot(path: string): boolean {
  return !!slots[`cell-${path}`];
}

function hasHeaderSlot(path: string): boolean {
  return !!slots[`header-${path}`];
}

function onSort(column: ColumnDef, direction: "asc" | "desc" | null) {
  emit("sort", column, direction);
}

function onHide(column: ColumnDef) {
  emit("hide", column);
}

function onFilter(column: ColumnDef) {
  emit("filter", column);
}

function onFiltersOff(column: ColumnDef) {
  emit("filters-off", column);
}

function onResetWidth(column: ColumnDef) {
  emit("reset-width", column);
}

function onRowClick(row: Record<string, unknown>, event: MouseEvent) {
  emit("row-click", row, event);
}

function onRowDblClick(row: Record<string, unknown>, event: MouseEvent) {
  emit("row-dblclick", row, event);
}

// ── Column drag-reorder state ────────────────────────────────────────────
const dragSourcePath = ref<string | null>(null);
const dropTarget = ref<{ path: string; position: ColumnReorderPosition } | null>(null);

function pathOf(event: Event): string | null {
  return (event.currentTarget as HTMLElement | null)?.dataset.columnPath ?? null;
}

function onHeaderDragStart(event: DragEvent) {
  if (!props.reorderable) return;
  // Suppress native drag-reorder when a pointer-driven resize is in flight.
  // `pointerdown` on the handle fires before `dragstart`, so this catches
  // the real-browser case where `<th draggable=true>` initiates drag even
  // though the gesture started inside `<div class="as-th-resize-handle"
  // draggable=false>`.
  if (resizingPath.value !== null) {
    event.preventDefault();
    return;
  }
  const path = pathOf(event);
  if (!path) return;
  dragSourcePath.value = path;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    // Firefox requires a non-empty payload to actually start a drag.
    event.dataTransfer.setData("text/plain", path);
  }
}

function onHeaderDragOver(event: DragEvent) {
  if (!props.reorderable || dragSourcePath.value === null) return;
  const path = pathOf(event);
  if (!path) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const position: ColumnReorderPosition =
    event.clientX - rect.left < rect.width / 2 ? "before" : "after";
  if (dropTarget.value?.path !== path || dropTarget.value?.position !== position) {
    dropTarget.value = { path, position };
  }
}

function onHeaderDrop(event: DragEvent) {
  if (!props.reorderable) return;
  event.preventDefault();
  const path = pathOf(event);
  const source = dragSourcePath.value;
  const target = dropTarget.value;
  if (path && source && target && target.path === path && source !== target.path) {
    emit("reorder", source, target.path, target.position);
  }
  dragSourcePath.value = null;
  dropTarget.value = null;
}

function onHeaderDragEnd() {
  dragSourcePath.value = null;
  dropTarget.value = null;
}

const resizingPath = ref<string | null>(null);
let resizeStartX = 0;
let resizeStartWidth = 0;

function thFromHandleEvent(event: Event): { th: HTMLTableCellElement; path: string } | null {
  const target = event.currentTarget as HTMLElement | null;
  const th = target?.closest("th") as HTMLTableCellElement | null;
  const path = th?.dataset.columnPath;
  if (!th || !path) return null;
  return { th, path };
}

function onResizeHandlePointerDown(event: PointerEvent) {
  if (!props.resizable) return;
  const found = thFromHandleEvent(event);
  if (!found) return;
  resizingPath.value = found.path;
  resizeStartX = event.clientX;
  resizeStartWidth = found.th.getBoundingClientRect().width;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onResizeHandlePointerMove(event: PointerEvent) {
  if (!resizingPath.value) return;
  const next = Math.round(
    Math.max(resizeStartWidth + (event.clientX - resizeStartX), props.columnMinWidth),
  );
  emit("resize", resizingPath.value, `${next}px`);
}

function onResizeHandleEnd() {
  resizingPath.value = null;
}

function onResizeHandleDoubleClick(event: MouseEvent) {
  if (!props.resizable) return;
  const found = thFromHandleEvent(event);
  if (!found) return;
  const { th, path } = found;
  const table = th.closest("table");
  if (!table) return;
  // `scrollWidth` reports the unclipped content extent even when the cell
  // currently truncates via `text-overflow: ellipsis`.
  let maxScroll = th.scrollWidth;
  const colIndex = th.cellIndex;
  for (const tr of table.querySelectorAll("tbody tr")) {
    const cell = tr.children[colIndex] as HTMLElement | undefined;
    if (cell) maxScroll = Math.max(maxScroll, cell.scrollWidth);
  }
  emit("resize", path, `${Math.max(maxScroll, props.columnMinWidth)}px`);
}

function widthStyle(col: ColumnDef): { width: string } | undefined {
  // Optional chain covers the brief render before the parent has seeded defaults.
  const entry = props.columnWidths[col.path];
  return entry ? { width: entry.w } : undefined;
}

function thClasses(path: string): Record<string, boolean> {
  const reorder = props.reorderable;
  const resize = props.resizable;
  if (!reorder && !resize) return {};
  return {
    "as-th-reorderable": reorder,
    "as-th-dragging": reorder && dragSourcePath.value === path,
    "as-th-drop-indicator-before":
      reorder && dropTarget.value?.path === path && dropTarget.value?.position === "before",
    "as-th-drop-indicator-after":
      reorder && dropTarget.value?.path === path && dropTarget.value?.position === "after",
    "as-th-resizing": resize && resizingPath.value === path,
  };
}
</script>

<template>
  <!--
    Always render the table + header so filter/sort/hide menus stay reachable
    even when rows are empty or the last query errored. The empty/error block
    renders AFTER </table> (but inside the scroll container) so its width is
    bound to the container, not the table's intrinsic fit-content width.
  -->
  <div class="as-table-scroll-container" data-virtual-scroll>
    <table
      class="as-table"
      :class="{
        'as-table-sticky': stickyHeader,
        'as-table-stretch': stretch,
      }"
    >
      <thead>
        <tr>
          <th v-if="hasValue" class="as-th-select">
            <span
              v-if="!asCombobox && select === 'multi' && selectedRows"
              class="as-table-checkbox"
              :class="{
                'as-table-checkbox-checked': selectedRows.length === rows.length && rows.length > 0,
                'as-table-checkbox-indeterminate':
                  selectedRows.length > 0 && selectedRows.length < rows.length,
              }"
              role="checkbox"
              tabindex="0"
              :aria-checked="
                selectedRows.length === 0
                  ? 'false'
                  : selectedRows.length === rows.length
                    ? 'true'
                    : 'mixed'
              "
              @click="
                selectedRows!.length === rows.length ? emit('deselect-all') : emit('select-all')
              "
            >
              <span
                v-if="selectedRows.length === rows.length && rows.length > 0"
                class="as-table-checkbox-tick"
                aria-hidden="true"
              />
              <span v-else-if="selectedRows.length > 0" class="as-table-checkbox-dash" />
            </span>
          </th>
          <th
            v-for="col in columns"
            :key="col.path"
            :data-column-path="col.path"
            :draggable="reorderable || undefined"
            :class="thClasses(col.path)"
            :style="widthStyle(col)"
            @dragstart="onHeaderDragStart"
            @dragover="onHeaderDragOver"
            @drop="onHeaderDrop"
            @dragend="onHeaderDragEnd"
          >
            <slot v-if="hasHeaderSlot(col.path)" :name="`header-${col.path}`" :column="col" />
            <AsTableHeaderCell
              v-else
              :column="col"
              :sort-direction="sortMap[col.path] ?? null"
              :filters="filters?.[col.path]"
              :column-menu="columnMenu"
              :width-entry="columnWidths[col.path]"
              @sort="onSort"
              @hide="onHide"
              @filter="onFilter"
              @filters-off="onFiltersOff"
              @reset-width="onResetWidth"
            />
            <div
              v-if="resizable"
              class="as-th-resize-handle"
              draggable="false"
              @dragstart.prevent.stop
              @pointerdown.stop="onResizeHandlePointerDown"
              @pointermove="onResizeHandlePointerMove"
              @pointerup="onResizeHandleEnd"
              @pointercancel="onResizeHandleEnd"
              @dblclick.stop="onResizeHandleDoubleClick"
            />
          </th>
          <th v-if="stretch" class="as-th-filler" />
        </tr>
      </thead>
      <!-- With selection/combobox: wrap in ListboxContent/Primitive -->
      <template v-if="hasValue && !queryError">
        <component :is="asCombobox ? Primitive : ListboxContent" as-child>
          <AsTableVirtualizer
            :options="rows"
            :estimate-size="virtualRowHeight"
            :overscan="virtualOverscan"
            :bypass="!virtualRowHeight"
            as="tbody"
          >
            <template #default="{ item, spaceBefore }">
              <component
                :is="asCombobox ? ComboboxItem : ListboxItem"
                as="tr"
                :value="rowValueFn ? rowValueFn(item) : undefined"
                :style="{
                  height: virtualRowHeight ? `${virtualRowHeight}px` : undefined,
                  transform: spaceBefore ? `translateY(${spaceBefore}px)` : undefined,
                }"
                @click="onRowClick(item, $event)"
                @dblclick="onRowDblClick(item, $event)"
              >
                <td v-if="hasValue" class="as-td-select">
                  <span class="as-table-checkbox">
                    <component
                      :is="asCombobox ? ComboboxItemIndicator : ListboxItemIndicator"
                      class="as-table-checkbox-tick"
                      aria-hidden="true"
                    />
                  </span>
                </td>
                <template v-for="col in columns" :key="col.path">
                  <td v-if="hasCellSlot(col.path)">
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
        </component>
      </template>
      <!-- No selection: plain rows -->
      <AsTableVirtualizer
        v-else
        :options="rows"
        :estimate-size="virtualRowHeight"
        :overscan="virtualOverscan"
        :bypass="!virtualRowHeight"
        as="tbody"
      >
        <template #default="{ item, spaceBefore }">
          <tr
            :style="{
              height: virtualRowHeight ? `${virtualRowHeight}px` : undefined,
              transform: spaceBefore ? `translateY(${spaceBefore}px)` : undefined,
            }"
            @click="onRowClick(item, $event)"
            @dblclick="onRowDblClick(item, $event)"
          >
            <template v-for="col in columns" :key="col.path">
              <td v-if="hasCellSlot(col.path)">
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
          </tr>
        </template>
      </AsTableVirtualizer>
    </table>
    <div v-if="queryError" class="as-table-error">
      <slot name="error" :error="queryError" :retry="onRetry">
        <div class="as-vh-empty">
          <span class="as-vh-error-icon i-as-warning" aria-hidden="true" />
          <p class="as-vh-empty-title">Failed to load values</p>
          <p class="as-vh-empty-body">{{ queryError.message }}</p>
          <button v-if="onRetry" type="button" class="as-vh-empty-clear" @click="onRetry">
            <span class="i-as-refresh" aria-hidden="true" />
            Retry
          </button>
        </div>
      </slot>
    </div>
    <div v-else-if="rows.length === 0 && !querying && columns.length > 0" class="as-table-empty">
      <slot
        name="empty"
        :search-term="searchTerm"
        :has-active-filters="hasActiveFilters"
        :on-clear-filters="onClearFilters"
      >
        <div class="as-vh-empty">
          <span class="as-vh-empty-icon i-as-search" aria-hidden="true" />
          <p class="as-vh-empty-title">No matching values</p>
          <p v-if="searchTerm" class="as-vh-empty-body">
            No entries match <span class="as-vh-empty-code">"{{ searchTerm }}"</span>. Try a
            different search.
          </p>
          <p v-else-if="hasActiveFilters" class="as-vh-empty-body">
            No entries match the current filters.
          </p>
          <p v-else class="as-vh-empty-body">No entries available</p>
          <button
            v-if="(searchTerm || hasActiveFilters) && onClearFilters"
            type="button"
            class="as-vh-empty-clear"
            @click="onClearFilters"
          >
            <span class="i-as-refresh" aria-hidden="true" />
            Clear filters
          </button>
        </div>
      </slot>
    </div>
    <slot name="last-row" />
  </div>
</template>
