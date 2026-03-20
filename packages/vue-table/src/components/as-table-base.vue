<script setup lang="ts">
import { computed, useSlots } from "vue";
import type { ColumnDef, SortControl } from "@atscript/ui-core";
import type { SelectionState } from "@atscript/ui-table";
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

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
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
  <AsTableVirtualizer
    v-else-if="useVirtual"
    :rows="rows"
    :estimate-size="virtualRowHeight"
    :overscan="virtualOverscan"
  >
    <template #default="{ virtualRows, totalSize }">
      <table class="as-table" :class="{ 'as-table-sticky': stickyHeader }">
        <thead>
          <tr>
            <th
              v-if="selection && selection.mode !== 'none'"
              class="as-th-select"
              style="width: 3em"
            >
              <input
                v-if="selection.mode === 'multi'"
                type="checkbox"
                :checked="selection.selectedCount === rows.length && rows.length > 0"
                :indeterminate="
                  selection.selectedCount > 0 && selection.selectedCount < rows.length
                "
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
              />
            </template>
          </tr>
        </thead>
        <tbody :style="{ height: `${totalSize}px`, position: 'relative' }">
          <tr
            v-for="vRow in virtualRows"
            :key="vRow.index"
            class="as-virtual-row"
            :style="{ top: `${vRow.start}px`, height: `${virtualRowHeight}px` }"
            :class="{ 'as-row-selected': isSelected(rows[vRow.index]!) }"
            @click="onRowClick(rows[vRow.index]!, $event)"
            @dblclick="onRowDblClick(rows[vRow.index]!, $event)"
          >
            <td v-if="selection && selection.mode !== 'none'" class="as-td-select">
              <input type="checkbox" :checked="isSelected(rows[vRow.index]!)" tabindex="-1" />
            </td>
            <template v-for="col in columns" :key="col.path">
              <td v-if="hasCellSlot(col.path)">
                <slot
                  :name="`cell-${col.path}`"
                  :row="rows[vRow.index]!"
                  :value="getCellValue(rows[vRow.index]!, col.path)"
                  :column="col"
                />
              </td>
              <AsTableCellValue v-else :row="rows[vRow.index]!" :column="col" />
            </template>
          </tr>
        </tbody>
      </table>
      <slot name="last-row" />
    </template>
  </AsTableVirtualizer>

  <!-- Table without virtualizer (small datasets) -->
  <div v-else class="as-table-scroll-container" style="overflow: auto">
    <table class="as-table" :class="{ 'as-table-sticky': stickyHeader }">
      <thead>
        <tr>
          <th v-if="selection && selection.mode !== 'none'" class="as-th-select" style="width: 3em">
            <input
              v-if="selection.mode === 'multi'"
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
            />
          </template>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="idx"
          :class="{ 'as-row-selected': isSelected(row) }"
          @click="onRowClick(row, $event)"
          @dblclick="onRowDblClick(row, $event)"
        >
          <td v-if="selection && selection.mode !== 'none'" class="as-td-select">
            <input type="checkbox" :checked="isSelected(row)" tabindex="-1" />
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
        </tr>
      </tbody>
    </table>
    <slot name="last-row" />
  </div>
</template>
