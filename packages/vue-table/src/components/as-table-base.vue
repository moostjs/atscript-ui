<script setup lang="ts">
import { computed, useSlots } from "vue";
import type { ColumnDef, SortControl } from "@atscript/ui";
import {
  ComboboxItem,
  ComboboxItemIndicator,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  Primitive,
} from "reka-ui";
import { getColumnWidth } from "../utils/column-width";
import { getCellValue } from "../utils/get-cell-value";
import AsTableHeaderCell from "./as-table-header-cell.vue";
import AsTableCellValue from "./as-table-cell-value.vue";
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
  }>(),
  {
    select: "none",
    stickyHeader: true,
    virtualOverscan: 5,
  },
);

const hasValue = computed(() => props.asCombobox || props.select !== "none");

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
  (e: "filter", column: ColumnDef): void;
  (e: "row-click", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "row-dblclick", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "select-all"): void;
  (e: "deselect-all"): void;
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

function onRowClick(row: Record<string, unknown>, event: MouseEvent) {
  emit("row-click", row, event);
}

function onRowDblClick(row: Record<string, unknown>, event: MouseEvent) {
  emit("row-dblclick", row, event);
}
</script>

<template>
  <!-- Error state -->
  <div v-if="queryError" class="as-table-error">
    <slot name="error" :error="queryError" :retry="onRetry">
      <p>Error: {{ queryError.message }}</p>
    </slot>
  </div>

  <!-- Loading state (initial, no rows yet) -->
  <div v-else-if="querying && rows.length === 0" class="as-table-loading">
    <slot name="loading">
      <p>Loading...</p>
    </slot>
  </div>

  <!-- Empty state -->
  <div v-else-if="!querying && rows.length === 0" class="as-table-empty">
    <slot name="empty">
      <p>No data</p>
    </slot>
  </div>

  <!-- Table -->
  <div v-else class="as-table-scroll-container">
    <table class="as-table" :class="{ 'as-table-sticky': stickyHeader }">
      <thead>
        <tr>
          <th v-if="hasValue" class="as-th-select" style="width: 3em">
            <input
              v-if="!asCombobox && select === 'multi' && selectedRows"
              type="checkbox"
              :checked="selectedRows.length === rows.length && rows.length > 0"
              :indeterminate="selectedRows.length > 0 && selectedRows.length < rows.length"
              @change="
                selectedRows!.length === rows.length ? emit('deselect-all') : emit('select-all')
              "
            />
          </th>
          <template v-for="col in columns" :key="col.path">
            <th
              v-if="hasHeaderSlot(col.path)"
              :style="{ width: getColumnWidth(col), minWidth: getColumnWidth(col) }"
            >
              <slot :name="`header-${col.path}`" :column="col" />
            </th>
            <AsTableHeaderCell
              v-else
              :column="col"
              :sort-direction="sortMap[col.path] ?? null"
              @sort="onSort"
              @hide="onHide"
              @filter="onFilter"
            />
          </template>
        </tr>
      </thead>
      <!-- With selection/combobox: wrap in ListboxContent/Primitive -->
      <template v-if="hasValue">
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
                  <component
                    :is="asCombobox ? ComboboxItemIndicator : ListboxItemIndicator"
                    class="as-selection-indicator"
                  >
                    &#x2713;
                  </component>
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
          </tr>
        </template>
      </AsTableVirtualizer>
    </table>
    <slot name="last-row" />
  </div>
</template>
