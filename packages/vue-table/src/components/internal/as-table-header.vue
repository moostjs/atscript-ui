<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef, SortControl } from "@atscript/ui";
import type { ColumnReorderPosition, ColumnWidthsMap, FieldFilters } from "@atscript/ui-table";
import type { ColumnMenuConfig, SelectAllState } from "../../types";
import { useColumnHeaderDragResize } from "../../composables/use-column-header-drag-resize";
import AsTableHeaderCell from "../defaults/as-table-header-cell.vue";

const props = withDefaults(
  defineProps<{
    columns: ColumnDef[];
    sorters: SortControl[];
    filters?: FieldFilters;
    columnMenu?: ColumnMenuConfig;
    columnWidths: ColumnWidthsMap;
    reorderable?: boolean;
    resizable?: boolean;
    columnMinWidth?: number;
    /** Whether the leading select cell (`<th class="as-th-select">`) renders. */
    hasSelectColumn?: boolean;
    /** Tri-state for the multi-select header checkbox. Undefined → no checkbox rendered. */
    selectAllState?: SelectAllState;
    /** Whether the trailing `<th class="as-th-filler">` renders. */
    withFiller?: boolean;
    /** Optional double-click auto-fit on the resize handle (base only). */
    enableAutoFit?: boolean;
  }>(),
  {
    reorderable: true,
    resizable: true,
    columnMinWidth: 48,
    hasSelectColumn: false,
    withFiller: false,
    enableAutoFit: false,
  },
);

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
  (e: "filter", column: ColumnDef): void;
  (e: "filters-off", column: ColumnDef): void;
  (e: "reset-width", column: ColumnDef): void;
  (e: "reorder", fromPath: string, toPath: string, position: ColumnReorderPosition): void;
  (e: "resize", path: string, width: string): void;
  /** Click on the multi-select header checkbox; parent decides select vs deselect. */
  (e: "select-all-toggle", state: SelectAllState): void;
}>();

const sortMap = computed(() => {
  const map: Record<string, "asc" | "desc"> = {};
  for (const s of props.sorters) map[s.field] = s.direction;
  return map;
});

const {
  onHeaderDragStart,
  onHeaderDragOver,
  onHeaderDrop,
  onHeaderDragEnd,
  onResizeHandlePointerDown,
  onResizeHandlePointerMove,
  onResizeHandleEnd,
  onResizeHandleDoubleClick,
  thClasses,
  widthStyle,
} = useColumnHeaderDragResize({
  reorderable: () => props.reorderable,
  resizable: () => props.resizable,
  columnMinWidth: () => props.columnMinWidth,
  columnWidths: () => props.columnWidths,
  onReorder: (from, to, position) => emit("reorder", from, to, position),
  onResize: (path, width) => emit("resize", path, width),
  onAutoFit: props.enableAutoFit
    ? (th, path) => {
        const table = th.closest("table") as HTMLTableElement | null;
        if (!table) return;
        const measured = measureNaturalColumnWidth(th, table);
        if (measured > 0) {
          emit("resize", path, `${Math.max(Math.ceil(measured), props.columnMinWidth)}px`);
          return;
        }
        // Layout-based measurement returned 0 (test environment without real
        // layout, e.g. happy-dom). Fall back to scrollWidth across the column.
        let fallback = th.scrollWidth;
        const colIndex = th.cellIndex;
        for (const tr of table.querySelectorAll("tbody tr")) {
          const cell = tr.children[colIndex] as HTMLElement | undefined;
          if (cell) fallback = Math.max(fallback, cell.scrollWidth);
        }
        emit("resize", path, `${Math.max(fallback, props.columnMinWidth)}px`);
      }
    : undefined,
});

// Measure a column's natural content width by temporarily switching the table
// to `table-layout: auto` and letting the th size to `max-content`. The browser
// computes the right answer across all visible rows in one synchronous reflow.
// This is the only reliable way: scrollWidth equals clientWidth once the cell
// is wider than its content, and the inner header button uses `w-full` so its
// own natural width is unmeasurable from the outside.
//
// The table also gets `width: max-content; min-width: 0` during measurement —
// otherwise `as-table-stretch` (`min-w-full`) keeps the table glued to its
// container, and the target column absorbs whatever leftover space the other
// explicit-width columns don't claim, measuring far wider than its content.
function measureNaturalColumnWidth(th: HTMLTableCellElement, table: HTMLTableElement): number {
  const origTableLayout = table.style.tableLayout;
  const origTableWidth = table.style.width;
  const origTableMinWidth = table.style.minWidth;
  const origThWidth = th.style.width;
  table.style.tableLayout = "auto";
  table.style.minWidth = "0";
  table.style.width = "max-content";
  th.style.width = "max-content";
  const measured = th.offsetWidth;
  th.style.width = origThWidth;
  table.style.width = origTableWidth;
  table.style.minWidth = origTableMinWidth;
  table.style.tableLayout = origTableLayout;
  return measured;
}
</script>

<template>
  <thead>
    <tr>
      <th v-if="hasSelectColumn" class="as-th-select">
        <span
          v-if="selectAllState"
          class="as-table-checkbox"
          :class="{
            'as-table-checkbox-checked': selectAllState === 'all',
            'as-table-checkbox-indeterminate': selectAllState === 'some',
          }"
          role="checkbox"
          tabindex="0"
          :aria-checked="
            selectAllState === 'none' ? 'false' : selectAllState === 'all' ? 'true' : 'mixed'
          "
          @click="emit('select-all-toggle', selectAllState)"
        >
          <span v-if="selectAllState === 'all'" class="as-table-checkbox-tick" aria-hidden="true" />
          <span v-else-if="selectAllState === 'some'" class="as-table-checkbox-dash" />
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
        <slot :name="`header-${col.path}`" :column="col">
          <AsTableHeaderCell
            :column="col"
            :sort-direction="sortMap[col.path] ?? null"
            :filters="filters?.[col.path]"
            :column-menu="columnMenu"
            :width-entry="columnWidths[col.path]"
            @sort="(c, d) => emit('sort', c, d)"
            @hide="(c) => emit('hide', c)"
            @filter="(c) => emit('filter', c)"
            @filters-off="(c) => emit('filters-off', c)"
            @reset-width="(c) => emit('reset-width', c)"
          />
        </slot>
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
      <th v-if="withFiller" class="as-th-filler" />
    </tr>
  </thead>
</template>
