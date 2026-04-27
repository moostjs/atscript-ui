<script setup lang="ts">
import { computed, useSlots } from "vue";
import type { ColumnDef, SortControl } from "@atscript/ui";
import {
  filledFilterCount,
  type ColumnReorderPosition,
  type ColumnWidthsMap,
  type FieldFilters,
} from "@atscript/ui-table";
import type { ColumnMenuConfig, SelectAllState } from "../../types";
import {
  ComboboxItem,
  ComboboxItemIndicator,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
  Primitive,
} from "reka-ui";
import { getCellValue } from "../../utils/get-cell-value";
import AsTableCellValue from "../defaults/as-table-cell-value.vue";
import AsTableHeader from "./as-table-header.vue";
import AsTableStatus from "./as-table-status.vue";
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

const showSelectAllCheckbox = computed(
  () => !props.asCombobox && props.select === "multi" && !!props.selectedRows,
);

const selectAllState = computed<SelectAllState | undefined>(() => {
  if (!showSelectAllCheckbox.value) return undefined;
  const sel = props.selectedRows!;
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

function hasCellSlot(path: string): boolean {
  return !!slots[`cell-${path}`];
}

function onRowClick(row: Record<string, unknown>, event: MouseEvent) {
  emit("row-click", row, event);
}

function onRowDblClick(row: Record<string, unknown>, event: MouseEvent) {
  emit("row-dblclick", row, event);
}

function onSelectAllToggle(state: SelectAllState) {
  // Tri-state semantics: only fully-checked deselects; partial/empty selects all.
  if (state === "all") emit("deselect-all");
  else emit("select-all");
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
