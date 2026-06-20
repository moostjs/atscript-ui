<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useSlots, watch } from "vue";
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
import { useCellResolver } from "../../composables/use-cell-resolver";
import { useCellComponents } from "../../composables/use-cell-components";
import AsTableColgroup from "./as-table-colgroup.vue";
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
    /**
     * When true, omit the `<thead>` entirely (not `display:none`). Column
     * widths are carried by the `<colgroup>`, so data columns keep their
     * annotated/seeded widths without a header. Header-driven interactions
     * (sort/filter/reorder/resize) simply don't exist in this mode.
     */
    headless?: boolean;
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
    headless: false,
  },
);

const ctx = useTableContextOptional();
const { resolve: cellResolver, hasAnyCellBindings } = useCellResolver(
  () => ctx?.state.tableDef.value ?? null,
);
const cellComponents = useCellComponents(() => props.columns);

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
  // Single-click never fires main-action — the default row action is
  // reserved for double-click and Enter-key (per the keyboard contract).
  // In select mode click toggles; in `select="none"` click is just an
  // active-row pointer.
  if (props.select === "none") return;
  if (!ctx) return;
  ctx.state.toggleActiveSelection(props.select);
}

function onRowDblClick(row: Record<string, unknown>, event: MouseEvent, index: number) {
  emit("row-dblclick", row, event);
  if (!isStandalone.value || !ctx) return;
  // dblclick activates regardless of select mode; in select="none" the prior
  // single-click already requested main-action — re-firing on dblclick keeps
  // the gesture explicit and aligns Enter / dblclick / single-click semantics.
  ctx.state.setActive(index);
  ctx.state.requestMainAction(event);
}

function onSelectAllToggle(state: SelectAllState) {
  // Tri-state semantics: only fully-checked deselects; partial/empty selects all.
  if (state === "all") emit("deselect-all");
  else emit("select-all");
}

function onTbodyKeydown(event: KeyboardEvent) {
  if (!isStandalone.value || !ctx) return;
  ctx.state.handleNavKey(event, { mode: props.select });
}

const scrollContainerRef = ref<HTMLElement | null>(null);

// Sub-pixel slack: scrollTop reads back fractionally off our integer
// write on hi-DPI hosts; without slack the visibility check re-arms and
// oscillates by ±1 row.
const SCROLL_TOL = 1.5;

// Hand-rolled scrollTop math because `scrollIntoView` ignores sticky
// `<thead>` (row bbox overlaps container while row hides behind thead)
// and `virtualizer.scrollToIndex` uses a coord system that ignores the
// thead, landing ~1 row short of `maxScrollTop` for the last row.
//
// Boundary rows pin to live `0` / `maxScrollTop`; middle rows go through
// `Math.round(clamp(...))` and skip writes <1px to avoid browser round-
// trip oscillation. Pairs with `[overflow-anchor:none]` on the scroll
// container — without that CSS rule, browsers still re-adjust scrollTop
// on virtualizer re-renders and the jitter comes back.
function alignActiveRow(idx: number) {
  if (!ctx) return;
  const container = scrollContainerRef.value;
  if (!container) return;
  const rowHeight = props.virtualRowHeight;
  const thead = container.querySelector("thead") as HTMLElement | null;
  const theadHeight = thead?.offsetHeight ?? 0;

  if (rowHeight) {
    const total = props.rows.length;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    let target = container.scrollTop;
    if (idx >= total - 1) {
      target = maxScrollTop;
    } else if (idx <= 0) {
      target = 0;
    } else {
      const rowTop = theadHeight + idx * rowHeight;
      const rowBottom = rowTop + rowHeight;
      const visibleTop = container.scrollTop + theadHeight;
      const visibleBottom = container.scrollTop + container.clientHeight;
      if (rowTop < visibleTop - SCROLL_TOL) {
        target = rowTop - theadHeight;
      } else if (rowBottom > visibleBottom + SCROLL_TOL) {
        target = rowBottom - container.clientHeight;
      } else {
        return;
      }
    }
    target = Math.round(Math.max(0, Math.min(maxScrollTop, target)));
    if (Math.abs(target - container.scrollTop) < 1) return;
    container.scrollTop = target;
    return;
  }

  const el = document.getElementById(ctx.state.rowId(idx));
  if (!el) return;
  const containerRect = container.getBoundingClientRect();
  const rowRect = el.getBoundingClientRect();
  const stickyTop = containerRect.top + theadHeight;
  if (rowRect.top < stickyTop - SCROLL_TOL) {
    container.scrollTop -= stickyTop - rowRect.top;
  } else if (rowRect.bottom > containerRect.bottom + SCROLL_TOL) {
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
  // `flush: "post"` so DOM is up-to-date when `alignActiveRow` measures —
  // a sync watcher would read stale geometry. `setActive` already diffs
  // before writing `activeIndex`, so this fires at most once per genuine
  // change; key auto-repeat at the boundary is a no-op.
  watch(
    () => ctx.state.activeIndex.value,
    (idx) => {
      if (!isStandalone.value || idx < 0) return;
      alignActiveRow(idx);
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
      <AsTableColgroup
        :columns="columns"
        :column-widths="columnWidths"
        :has-select="hasValue"
        :with-filler="stretch"
      />
      <AsTableHeader
        v-if="!headless"
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
          <template #default="{ item, index, spaceBefore }">
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
              <template v-if="hasAnyCellBindings">
                <template v-for="col in columns" :key="col.path">
                  <template v-for="bindings in [cellResolver(col, item, index)]" :key="0">
                    <td v-if="cellSlotFlags[col.path]" v-bind="bindings">
                      <slot
                        :name="`cell-${col.path}`"
                        :row="item"
                        :value="getCellValue(item, col.path)"
                        :column="col"
                      />
                    </td>
                    <component
                      v-else
                      :is="cellComponents[col.path]"
                      :row="item"
                      :column="col"
                      v-bind="bindings"
                    />
                  </template>
                </template>
              </template>
              <template v-else>
                <template v-for="col in columns" :key="col.path">
                  <td v-if="cellSlotFlags[col.path]">
                    <slot
                      :name="`cell-${col.path}`"
                      :row="item"
                      :value="getCellValue(item, col.path)"
                      :column="col"
                    />
                  </td>
                  <component v-else :is="cellComponents[col.path]" :row="item" :column="col" />
                </template>
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
            <template v-if="hasAnyCellBindings">
              <template v-for="col in columns" :key="col.path">
                <template v-for="bindings in [cellResolver(col, item, index)]" :key="0">
                  <td v-if="cellSlotFlags[col.path]" role="gridcell" v-bind="bindings">
                    <slot
                      :name="`cell-${col.path}`"
                      :row="item"
                      :value="getCellValue(item, col.path)"
                      :column="col"
                    />
                  </td>
                  <component
                    v-else
                    :is="cellComponents[col.path]"
                    :row="item"
                    :column="col"
                    role="gridcell"
                    v-bind="bindings"
                  />
                </template>
              </template>
            </template>
            <template v-else>
              <template v-for="col in columns" :key="col.path">
                <td v-if="cellSlotFlags[col.path]" role="gridcell">
                  <slot
                    :name="`cell-${col.path}`"
                    :row="item"
                    :value="getCellValue(item, col.path)"
                    :column="col"
                  />
                </td>
                <component
                  v-else
                  :is="cellComponents[col.path]"
                  :row="item"
                  :column="col"
                  role="gridcell"
                />
              </template>
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
