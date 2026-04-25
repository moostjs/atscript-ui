<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import type { ColumnDef, ResolvedValueHelp } from "@atscript/ui";
import { resolveValueHelp, valueHelpDictPaths } from "@atscript/ui";
import { filledFilterCount, isSimpleEq, type FilterCondition } from "@atscript/ui-table";
import { ListboxRoot } from "reka-ui";
import { useTable } from "../../composables/use-table";
import AsTable from "../as-table.vue";
import AsTableBase from "./as-table-base.vue";
import AsFilterDialog from "../defaults/as-filter-dialog.vue";
import AsConfigDialog from "../defaults/as-config-dialog.vue";
import AsFilters from "../as-filters.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

const model = defineModel<FilterCondition[]>({ default: () => [] });

const info = props.column.valueHelpInfo;
const options = props.column.options;

const selectedValues = computed<unknown[]>({
  get: () => {
    const values: unknown[] = [];
    for (const c of model.value) {
      if (isSimpleEq(c)) values.push(c.value[0]);
    }
    return values;
  },
  set: (values) => {
    const next: FilterCondition[] = [];
    for (const v of values) {
      next.push({ type: "eq", value: [v as string | number | boolean] });
    }
    model.value = next;
  },
});

const resolved = shallowRef<ResolvedValueHelp | null>(null);

// For FK: spin up our own table state and provide it to the subtree so
// <AsTable> below uses it for columnNames, sorters, hide, etc.
const innerState = info
  ? useTable(info.url, {
      limit: 1000,
      select: "multi",
      queryOnMount: true,
      provideContext: true,
      rowValueFn: (row) => row[info.targetField],
      manageSelection: false,
    })
  : undefined;

// The dialog only mounts when the user opens it, so resolve on mount.
if (info) {
  onMounted(() => {
    void resolveValueHelp(info.url)
      .then((r) => {
        resolved.value = r;
      })
      .catch(() => {
        // If meta fails, the inner table will still show whatever came through
        // its own meta fetch; resolved stays null and dict clamping is skipped.
      });
  });
}

// Clamp visible columns to the value-help whitelist once BOTH:
//   - the inner table has its TableDef loaded (so allColumns is populated)
//   - resolveValueHelp has produced the dict field names
// Then seed filterFields with all filterable dict columns.
if (innerState) {
  let initialized = false;
  const stop = watch(
    [() => innerState.tableDef.value, resolved],
    ([def, r]) => {
      if (!def || !r || initialized) return;
      initialized = true;
      const dictPaths = valueHelpDictPaths(r);
      const dictCols = innerState.allColumns.value.filter((c) => dictPaths.has(c.path));
      innerState.columnNames.value = dictCols.map((c) => c.path);
      if (innerState.filterFields.value.length === 0) {
        innerState.filterFields.value = dictCols.filter((c) => c.filterable).map((c) => c.path);
      }
      stop();
    },
    { immediate: true },
  );
}

// Two-way sync between our model (FilterCondition[]) and state.selectedRows.
if (innerState) {
  watch(
    selectedValues,
    (v) => {
      if (!arraysEq(v, innerState.selectedRows.value)) {
        innerState.selectedRows.value = v;
      }
    },
    { immediate: true, deep: true },
  );
  watch(
    () => innerState.selectedRows.value,
    (v) => {
      if (!arraysEq(v, selectedValues.value)) {
        selectedValues.value = v;
      }
    },
    { deep: true },
  );
}

function arraysEq(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const v of b) if (!sa.has(v)) return false;
  return true;
}

const searchable = computed(() => !!innerState?.tableDef.value?.searchable);

const showFilters = ref(false);
watch(
  searchable,
  (v) => {
    showFilters.value = !v;
  },
  { immediate: true },
);

const hasFilterableFields = computed(
  () => !!innerState && innerState.filterFields.value.length > 0,
);

// Enum path: static rows, single synthetic column, no innerState.
const enumRows: Record<string, unknown>[] = options
  ? options.map((o) => ({ __value: o.key, __label: o.label }))
  : [];

const enumColumns: ColumnDef[] = [
  {
    path: "__label",
    label: "Value",
    type: "text",
    sortable: true,
    filterable: false,
    visible: true,
    order: 0,
  },
];

const enumSort = ref<{ field: string; direction: "asc" | "desc" } | null>(null);
const enumSorters = computed(() => (enumSort.value ? [enumSort.value] : []));

function onEnumSort(column: ColumnDef, direction: "asc" | "desc" | null) {
  enumSort.value = direction ? { field: column.path, direction } : null;
}

// Single source of truth: the FK (info) path reads/writes innerState.searchTerm
// directly so AsTable's built-in "Clear filters" button propagates to the input
// without a sync watch. The enum path has no innerState, so it falls back to a
// local ref that drives filteredEnumRows.
const localSearchTerm = ref("");
const searchTerm = computed<string>({
  get: () => (innerState ? innerState.searchTerm.value : localSearchTerm.value),
  set: (value) => {
    if (innerState) innerState.searchTerm.value = value;
    else localSearchTerm.value = value;
  },
});

function onSearchInput(event: Event) {
  searchTerm.value = (event.target as HTMLInputElement).value;
}

const filteredEnumRows = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  const base = term
    ? enumRows.filter((r) =>
        String(r.__label ?? "")
          .toLowerCase()
          .includes(term),
      )
    : enumRows;
  if (!enumSort.value) return base;
  const dir = enumSort.value.direction === "desc" ? -1 : 1;
  return [...base].toSorted((a, b) => {
    const av = String(a.__label ?? "").toLowerCase();
    const bv = String(b.__label ?? "").toLowerCase();
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });
});

function enumRowValueFn(row: Record<string, unknown>): unknown {
  return row.__value;
}

const totalCount = computed(() => (info ? (innerState?.totalCount.value ?? 0) : enumRows.length));

function onSelectAll() {
  selectedValues.value = filteredEnumRows.value.map(enumRowValueFn);
}

function onDeselectAll() {
  selectedValues.value = [];
}

const hasActiveFilters = computed(() =>
  innerState ? filledFilterCount(innerState.filters.value) > 0 : false,
);

function clearSearch() {
  searchTerm.value = "";
}

function clearAllFilters() {
  innerState?.resetFilters();
}
</script>

<template>
  <div class="as-filter-value-help">
    <div class="as-filter-value-help-toolbar">
      <div v-if="!info || searchable" class="as-filter-value-help-search-wrap">
        <span class="as-filter-value-help-search-icon i-as-search" aria-hidden="true" />
        <input
          :value="searchTerm"
          type="text"
          class="as-filter-value-help-search"
          placeholder="Search..."
          autocomplete="off"
          @input="onSearchInput"
        />
      </div>
      <span class="as-filter-value-help-count">
        <button
          v-if="searchable && hasFilterableFields"
          type="button"
          class="as-filter-value-help-filters-toggle"
          :class="{ 'as-filter-value-help-filters-toggle-active': showFilters }"
          :title="showFilters ? 'Hide filters' : 'Show filters'"
          @click="showFilters = !showFilters"
        >
          <span class="i-as-filter" aria-hidden="true" />
        </button>
        {{ totalCount }} records
      </span>
    </div>
    <div v-if="info && showFilters" class="as-filter-value-help-filters">
      <AsFilters />
      <div class="as-spacer" />
      <button
        v-if="hasActiveFilters"
        type="button"
        class="as-filter-dialog-clear-all"
        @click="clearAllFilters"
      >
        Clear all
      </button>
    </div>

    <!-- FK: full AsTable using provided innerState (sort/filter via state). Hiding disabled.
         Render the inner filter/config dialogs so the inner table is fully functional
         (clicking "Filter" in its column menu opens a nested filter dialog). -->
    <template v-if="info">
      <AsTable :column-menu="{ sort: true, filters: true, hide: false }" :sticky-header="true" />
      <AsFilterDialog />
      <AsConfigDialog />
    </template>

    <!-- Enum: fixed single-column list. Sort enabled, hide disabled. -->
    <ListboxRoot
      v-else
      v-model="selectedValues"
      :multiple="true"
      class="as-filter-value-help-table"
    >
      <AsTableBase
        :columns="enumColumns"
        :rows="filteredEnumRows"
        :sorters="enumSorters"
        :selected-rows="selectedValues"
        select="multi"
        :row-value-fn="enumRowValueFn"
        :sticky-header="true"
        :stretch="true"
        :search-term="searchTerm"
        :on-clear-filters="clearSearch"
        :column-menu="{ sort: true, filters: false, hide: false }"
        @sort="onEnumSort"
        @select-all="onSelectAll"
        @deselect-all="onDeselectAll"
      />
    </ListboxRoot>
  </div>
</template>
