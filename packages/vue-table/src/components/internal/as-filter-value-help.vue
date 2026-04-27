<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import type { ColumnDef, ResolvedValueHelp } from "@atscript/ui";
import { resolveValueHelp, valueHelpDictPaths } from "@atscript/ui";
import {
  filledFilterCount,
  isSimpleEq,
  sameColumnSet,
  type FilterCondition,
} from "@atscript/ui-table";
import type { Client } from "@atscript/db-client";
import type { ReactiveTableState } from "../../types";
import { useTable } from "../../composables/use-table";
import { createStaticTableState, provideTableContext } from "../../composables/use-table-state";
import { useTableNavBridge } from "../../composables/use-table-nav-bridge";
import AsWindowTable from "../as-window-table.vue";
import AsFilterDialog from "../defaults/as-filter-dialog.vue";
import AsConfigDialog from "../defaults/as-config-dialog.vue";
import AsFilters from "../as-filters.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

const model = defineModel<FilterCondition[]>({ default: () => [] });

const info = props.column.valueHelpInfo;
const options = props.column.options;

function modelToValues(conds: FilterCondition[]): unknown[] {
  const values: unknown[] = [];
  for (const c of conds) if (isSimpleEq(c)) values.push(c.value[0]);
  return values;
}
function valuesToModel(values: unknown[]): FilterCondition[] {
  const next: FilterCondition[] = [];
  for (const v of values) next.push({ type: "eq", value: [v as string | number | boolean] });
  return next;
}

// Single backing ref. Initialized from `model` once, then handed to the
// table state — `state.selectedRows === selectionRef` for the dialog's
// lifetime, so user toggles flow into this ref directly. The reverse
// direction (parent mutating `model` while the dialog is open) is not
// honoured: the dialog is the only writer for this column's filter.
const selectionRef = ref<unknown[]>(modelToValues(model.value));

const resolved = shallowRef<ResolvedValueHelp | null>(null);

let innerState: ReactiveTableState | undefined;

if (info) {
  innerState = useTable(info.url, {
    limit: 100,
    select: "multi",
    // queryOnMount stays false: we trigger query() manually after clamping
    // columnNames to dict paths so the bootstrap query doesn't go out with
    // every table column, and so we don't fire two queries (auto-bootstrap
    // + columnNames-watcher re-fire).
    queryOnMount: false,
    provideContext: true,
    rowValueFn: (row) => row[info.targetField],
    selectionPersistence: "persist",
    selectedRows: selectionRef,
  });
} else if (options) {
  const enumRows: Record<string, unknown>[] = options.map((o) => ({
    __value: o.key,
    __label: o.label,
  }));
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
  const { state } = createStaticTableState({
    rows: enumRows,
    columns: enumColumns,
    searchPaths: ["__label"],
    selection: {
      mode: "multi",
      rowValueFn: (row) => row.__value,
      selectedRows: selectionRef,
    },
  });
  innerState = state;
  provideTableContext({ state, client: {} as Client, components: {} });
}

// FK only: resolve value-help meta on mount so column-clamp watcher knows
// which fields to keep.
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

// FK: clamp visible columns to the value-help whitelist once BOTH:
//   - the inner table has its TableDef loaded (so allColumns is populated)
//   - resolveValueHelp has produced the dict field names
// Then seed filterFields with all filterable dict columns. The columnNames
// mutation, filterFields seeding, and explicit query() all coalesce into
// one microtask-scheduled fetch (see use-table-state.ts scheduleQuery).
if (info && innerState) {
  const fkState = innerState;
  let initialized = false;
  const stop = watch(
    [() => fkState.tableDef.value, resolved],
    ([def, r]) => {
      if (!def || !r || initialized) return;
      initialized = true;
      stop();
      const dictPaths = valueHelpDictPaths(r);
      const dictCols = fkState.allColumns.value.filter((c) => dictPaths.has(c.path));
      fkState.columnNames.value = dictCols.map((c) => c.path);
      if (fkState.filterFields.value.length === 0) {
        fkState.filterFields.value = dictCols.filter((c) => c.filterable).map((c) => c.path);
      }
      fkState.query();
    },
    { immediate: true },
  );
}

// No `enterAction` override — the listener-driven fallback in
// `state.handleNavKey` does the right thing: nobody registers `@main-action`
// on `<AsWindowTable>` inside the dialog, so Enter falls through to
// `toggleActiveSelection()` (mirroring Space).
const navBridge = innerState ? useTableNavBridge(innerState) : undefined;

if (innerState) {
  watch(selectionRef, (v) => {
    if (sameColumnSet(modelToValues(model.value), v)) return;
    model.value = valuesToModel(v);
  });
}

const searchable = computed(() => {
  if (!innerState) return false;
  // FK reads `searchable` off the loaded TableDef; enum's static TableDef
  // sets `searchable: true` whenever `searchPaths` were provided.
  return !!innerState.tableDef.value?.searchable;
});

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

const totalCount = computed(() => innerState?.totalCount.value ?? 0);

const hasActiveFilters = computed(() =>
  innerState ? filledFilterCount(innerState.filters.value) > 0 : false,
);

function clearAllFilters() {
  innerState?.resetFilters();
}
</script>

<template>
  <div class="as-filter-value-help">
    <div class="as-filter-value-help-toolbar">
      <div v-if="searchable" class="as-filter-value-help-search-wrap">
        <span class="as-filter-value-help-search-icon i-as-search" aria-hidden="true" />
        <input
          :value="innerState?.searchTerm.value ?? ''"
          type="text"
          class="as-filter-value-help-search"
          placeholder="Search..."
          autocomplete="off"
          @input="
            (e: Event) => {
              if (innerState) innerState.searchTerm.value = (e.target as HTMLInputElement).value;
            }
          "
          @keydown="(e: KeyboardEvent) => navBridge?.onKeydown(e)"
        />
      </div>
      <span class="as-filter-value-help-count">
        <button
          v-if="info && searchable && hasFilterableFields"
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
    <!-- Same window-table chrome for both branches. The enum branch's
         in-memory state was provided into context above via
         `provideTableContext`, so `<AsWindowTable>`'s `useTableContext()`
         resolves identically to the FK branch's `useTable(...)`-provided
         state. -->
    <AsWindowTable
      v-if="innerState"
      :column-menu="{
        sort: true,
        filters: !!info,
        hide: false,
      }"
    />
    <!-- FK only: nested filter / config dialogs for the inner table's
         column menu. Enum's column menu has filters/hide disabled, so
         the dialogs would never open. -->
    <template v-if="info">
      <AsFilterDialog />
      <AsConfigDialog />
    </template>
  </div>
</template>
