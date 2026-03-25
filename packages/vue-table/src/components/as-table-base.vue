<script setup lang="ts">
import { computed, useSlots } from "vue";
import type { ColumnDef, SortControl } from "@atscript/ui";
import type { SelectionState } from "@atscript/ui-table";
import { ComboboxItem, ComboboxItemIndicator, Primitive } from "reka-ui";
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
    selection?: SelectionState;
    /** When true, rows render as ComboboxItem (must be inside a ComboboxRoot). */
    asCombobox?: boolean;
    /** Extract unique value from a row (required when asCombobox is true). */
    rowValueFn?: (row: Record<string, unknown>) => unknown;
    querying?: boolean;
    queryError?: Error | null;
    onRetry?: () => void;
    stickyHeader?: boolean;
    virtualRowHeight?: number;
    virtualOverscan?: number;
  }>(),
  {
    stickyHeader: true,
    virtualRowHeight: 40,
    virtualOverscan: 5,
  },
);

const showCheckbox = computed(
  () => props.asCombobox || (props.selection && props.selection.mode !== "none"),
);

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
  (e: "filter", column: ColumnDef): void;
  (e: "row-click", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "row-dblclick", row: Record<string, unknown>, event: MouseEvent): void;
  (e: "selection-toggle", row: Record<string, unknown>): void;
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
  if (props.selection && props.selection.mode !== "none") {
    emit("selection-toggle", row);
  }
  emit("row-click", row, event);
}

function onRowDblClick(row: Record<string, unknown>, event: MouseEvent) {
  emit("row-dblclick", row, event);
}

function isSelected(row: Record<string, unknown>): boolean {
  return props.selection?.isSelected(row) ?? false;
}

const useVirtual = computed(() => props.rows.length > 50);
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

  <!-- Table with virtualizer -->
  <div
    v-else-if="useVirtual"
    class="as-table-scroll-container"
    data-virtual-scroll
    style="overflow: auto"
  >
    <table class="as-table" :class="{ 'as-table-sticky': stickyHeader }">
      <thead>
        <tr>
          <th v-if="showCheckbox" class="as-th-select" style="width: 3em">
            <input
              v-if="!asCombobox && selection && selection.mode === 'multi'"
              type="checkbox"
              :checked="selection.selectedCount === rows.length && rows.length > 0"
              :indeterminate="selection.selectedCount > 0 && selection.selectedCount < rows.length"
              @change="
                selection!.selectedCount === rows.length
                  ? selection!.deselectAll()
                  : selection!.selectAll(rows)
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
      <AsTableVirtualizer
        :count="rows.length"
        :estimate-size="virtualRowHeight"
        :overscan="virtualOverscan"
      >
        <template #default="{ index, spaceBefore }">
          <component
            :is="asCombobox ? ComboboxItem : 'tr'"
            :as="asCombobox ? 'tr' : undefined"
            :value="asCombobox && rowValueFn ? rowValueFn(rows[index]!) : undefined"
            :style="{
              height: `${virtualRowHeight}px`,
              transform: spaceBefore ? `translateY(${spaceBefore}px)` : undefined,
            }"
            :class="{ 'as-row-selected': !asCombobox && isSelected(rows[index]!) }"
            @click="onRowClick(rows[index]!, $event)"
            @dblclick="onRowDblClick(rows[index]!, $event)"
          >
            <td v-if="showCheckbox" class="as-td-select">
              <ComboboxItemIndicator v-if="asCombobox" class="as-combobox-indicator">
                &#x2713;
              </ComboboxItemIndicator>
              <input v-else type="checkbox" :checked="isSelected(rows[index]!)" tabindex="-1" />
            </td>
            <template v-for="col in columns" :key="col.path">
              <td v-if="hasCellSlot(col.path)">
                <slot
                  :name="`cell-${col.path}`"
                  :row="rows[index]!"
                  :value="getCellValue(rows[index]!, col.path)"
                  :column="col"
                />
              </td>
              <AsTableCellValue v-else :row="rows[index]!" :column="col" />
            </template>
          </component>
        </template>
      </AsTableVirtualizer>
    </table>
    <slot name="last-row" />
  </div>

  <!-- Table without virtualizer (small datasets) -->
  <div v-else class="as-table-scroll-container" style="overflow: auto">
    <table class="as-table" :class="{ 'as-table-sticky': stickyHeader }">
      <thead>
        <tr>
          <th v-if="showCheckbox" class="as-th-select" style="width: 3em">
            <input
              v-if="!asCombobox && selection && selection.mode === 'multi'"
              type="checkbox"
              :checked="selection.selectedCount === rows.length && rows.length > 0"
              :indeterminate="selection.selectedCount > 0 && selection.selectedCount < rows.length"
              @change="
                selection!.selectedCount === rows.length
                  ? selection!.deselectAll()
                  : selection!.selectAll(rows)
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
      <component :is="asCombobox ? Primitive : 'tbody'" :as-child="asCombobox || undefined">
        <component
          :is="asCombobox ? ComboboxItem : 'tr'"
          v-for="(row, idx) in rows"
          :key="idx"
          :as="asCombobox ? 'tr' : undefined"
          :value="asCombobox && rowValueFn ? rowValueFn(row) : undefined"
          :class="{ 'as-row-selected': !asCombobox && isSelected(row) }"
          @click="onRowClick(row, $event)"
          @dblclick="onRowDblClick(row, $event)"
        >
          <td v-if="showCheckbox" class="as-td-select">
            <ComboboxItemIndicator v-if="asCombobox" class="as-combobox-indicator">
              &#x2713;
            </ComboboxItemIndicator>
            <input v-else type="checkbox" :checked="isSelected(row)" tabindex="-1" />
          </td>
          <template v-for="col in columns" :key="col.path">
            <td v-if="hasCellSlot(col.path)">
              <slot
                :name="`cell-${col.path}`"
                :row="row"
                :value="getCellValue(row, col.path)"
                :column="col"
              />
            </td>
            <AsTableCellValue v-else :row="row" :column="col" />
          </template>
        </component>
      </component>
    </table>
    <slot name="last-row" />
  </div>
</template>
