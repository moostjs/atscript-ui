<script setup lang="ts">
// Renders inner content of a header cell — label, sort/filter indicators,
// column-menu trigger. The surrounding `<th>` is owned by `<AsTableBase>`
// so column drag-reorder handlers can attach there. Replacement headerCell
// components supplied via the `:components` map MUST also render
// inner-of-`<th>` content only; wrapping in a `<th>` produces nested cells
// and breaks reorder.
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { ColumnWidthEntry, FilterCondition } from "@atscript/ui-table";
import { isFilled } from "@atscript/ui-table";
import type { ColumnMenuConfig } from "../../types";
import { useTableComponent } from "../../composables/use-table-component";
import AsColumnMenu from "./as-column-menu.vue";

// Skin-slot for the column-menu COMPONENT (`controls.columnMenu`) — distinct
// from the `columnMenu` data prop below, which configures menu sections.
const MenuComponent = useTableComponent("columnMenu", AsColumnMenu);

const props = withDefaults(
  defineProps<{
    column: ColumnDef;
    sortDirection?: "asc" | "desc" | null;
    filters?: FilterCondition[];
    columnMenu?: ColumnMenuConfig;
    /** Current column width entry (`{ w, d }`) — used to gate Reset Width. */
    widthEntry?: ColumnWidthEntry;
  }>(),
  {
    columnMenu: () => ({ sort: true, filters: true, hide: true, resetWidth: true }),
  },
);

const emit = defineEmits<{
  (e: "sort", column: ColumnDef, direction: "asc" | "desc" | null): void;
  (e: "hide", column: ColumnDef): void;
  (e: "filter", column: ColumnDef): void;
  (e: "filters-off", column: ColumnDef): void;
  (e: "reset-width", column: ColumnDef): void;
}>();

const filledCount = computed(() => props.filters?.filter(isFilled).length ?? 0);

function onMenuSort(direction: "asc" | "desc" | null) {
  emit("sort", props.column, direction);
}

function onMenuHide() {
  emit("hide", props.column);
}

function onMenuFilter() {
  emit("filter", props.column);
}

function onMenuFiltersOff() {
  emit("filters-off", props.column);
}

function onMenuResetWidth() {
  emit("reset-width", props.column);
}
</script>

<template>
  <component
    :is="MenuComponent"
    :column="props.column"
    :order="sortDirection"
    :filters="filters"
    :config="columnMenu"
    :width-entry="widthEntry"
    @sort="onMenuSort"
    @hide="onMenuHide"
    @filter="onMenuFilter"
    @filters-off="onMenuFiltersOff"
    @reset-width="onMenuResetWidth"
    v-slot="{ open, hasMenu }"
  >
    <button class="as-th-btn" type="button" @dragstart.stop>
      <span class="as-th-label">{{ props.column.label }}</span>
      <span class="as-th-indicators">
        <span v-if="filledCount" class="as-th-filter-badge i-as-filter" aria-hidden="true" />
        <span
          v-if="sortDirection"
          class="as-th-sort"
          :class="sortDirection === 'asc' ? 'i-as-arrow-up' : 'i-as-arrow-down'"
          aria-hidden="true"
        />
        <span
          v-if="hasMenu && !sortDirection && !filledCount"
          class="as-th-chevron"
          :class="open ? 'i-as-chevron-up' : 'i-as-chevron-down'"
          aria-hidden="true"
        />
      </span>
    </button>
  </component>
</template>
