<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, type Ref } from "vue";
import type { FilterExpr } from "@uniqu/core";
import type { ClientFactory, ResolvedValueHelp, ValueHelpInfo } from "@atscript/ui";
import { resolveValueHelp, valueHelpDictPaths, valueHelpSelect } from "@atscript/ui";
import { filledFilterCount, isColumnFilterable } from "@atscript/ui-table";
import type { ReactiveTableState } from "../../types";
import { useTable } from "../../composables/use-table";
import { useTableContextOptional } from "../../composables/use-table-state";
import { declineIfRejected } from "../../composables/use-value-pickers";
import { useTableNavBridge } from "../../composables/use-table-nav-bridge";
import AsWindowTable from "../as-window-table.vue";
import AsFilterDialog from "../defaults/as-filter-dialog.vue";
import AsConfigDialog from "../defaults/as-config-dialog.vue";
import AsFilters from "../as-filters.vue";
import { useAsTexts } from "@atscript/vue-form/locale";

type Row = Record<string, unknown>;

/**
 * The inner table of the value-help pickers: the table filter dialog's
 * (`select: "multi"`, values toggled into `selection`) and a form field's
 * picker dialog (`select: "single"`, Enter or a double-click picks a row).
 * With `info` it reads the dictionary itself; without, it renders the table
 * state its parent provided (the enum and distinct-values pickers).
 */
const props = defineProps<{
  select: "multi" | "single";
  /** The binding whose dictionary the table lists. */
  info?: ValueHelpInfo;
  /** The dictionary scope, AND'd into every query. Default: `info.filter`. */
  filter?: FilterExpr;
  /** Fields the scope pins: constant, so no column and no filter input. Default: `info.pinned`. */
  pinned?: string[];
  /** Text searched for once the dictionary is known to be searchable. */
  search?: string;
  /** The selected values (`"multi"`), kept as the selection model of the table. */
  selection?: Ref<unknown[]>;
  clientFactory?: ClientFactory;
}>();
const emit = defineEmits<{ pick: [row: Row] }>();
const texts = useAsTexts();
const { t } = texts;

// The table around the picker (a filter dialog's) — read before the inner state is provided.
const outer = useTableContextOptional();
const info = props.info;
const resolved = shallowRef<ResolvedValueHelp | null>(null);

let innerState: ReactiveTableState | undefined;
if (info) {
  innerState = useTable(info.url, {
    limit: 100,
    // queryOnMount stays false: the query runs once the columns are clamped to the
    // dictionary view below, so the first query does not go out with every column.
    queryOnMount: false,
    provideContext: true,
    rowValueFn: (row) => row[info.targetField],
    selectionPersistence: "persist",
    selectedRows: props.selection,
    // The scope, AND'd into every query. Every value-help read selects the same fields:
    // the committed one, the dictionary view, the columns and the fill targets.
    forceFilters: () => props.filter ?? info.filter,
    alwaysSelected: () =>
      resolved.value ? valueHelpSelect(resolved.value, info, "filter") : [info.targetField],
    clientFactory: props.clientFactory ?? outer?.clientFactory,
  });

  onMounted(() => {
    void resolveValueHelp(info.url, {
      texts,
      clientFactory: props.clientFactory ?? outer?.clientFactory,
    })
      .then((r) => {
        resolved.value = r;
      })
      .catch((err) => {
        // 4xx: the dictionary is not readable for this caller — a filter dialog falls
        // back to its conditions tab. Anything else: the table shows what its own meta
        // read brought; no clamping to the dictionary view.
        declineIfRejected(outer?.state, info, err);
      });
  });

  // Clamp the columns once the table's definition AND the dictionary roles are known,
  // seed the filter inputs, then query — one fetch (the state coalesces them).
  const fkState = innerState;
  let initialized = false;
  const stop = watch(
    [() => fkState.tableDef.value, resolved],
    ([def, r]) => {
      if (!def || !r || initialized) return;
      initialized = true;
      stop();
      // `@ui.valueHelp.column` (since 0.1.190): exactly these fields, in order. Else the
      // dictionary view; fields the scope pins with `=` are constant in the picker — no
      // column, no filter input.
      const byPath = new Map(fkState.allColumns.value.map((c) => [c.path, c]));
      const dictPaths = valueHelpDictPaths(r);
      const pinned = new Set(props.pinned ?? info.pinned);
      const dictCols = info.columns
        ? info.columns.flatMap((p) => byPath.get(p) ?? [])
        : fkState.allColumns.value.filter((c) => dictPaths.has(c.path) && !pinned.has(c.path));
      fkState.columnNames.value = dictCols.map((c) => c.path);
      if (fkState.filterFields.value.length === 0) {
        fkState.filterFields.value = dictCols.filter(isColumnFilterable).map((c) => c.path);
      }
      if (props.search && def.searchable) fkState.searchTerm.value = props.search;
      fkState.query();
    },
    { immediate: true },
  );
} else {
  innerState = outer?.state;
}

// Enter: `"multi"` toggles the active row (nobody listens for the main action);
// `"single"` picks it, as a double-click does.
const navBridge = innerState ? useTableNavBridge(innerState) : undefined;
const pickListener =
  props.select === "single" ? { mainAction: (row: Row) => emit("pick", row) } : {};

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

const totalCount = computed(() => innerState?.totalCount.value ?? 0);

const hasActiveFilters = computed(() =>
  innerState
    ? filledFilterCount(innerState.filters.value) > 0 || innerState.residualFilters.value.length > 0
    : false,
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
          :placeholder="t('UI_SEARCH_PLACEHOLDER')"
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
          :title="t(showFilters ? 'UI_FILTER_HIDE_FILTERS' : 'UI_FILTER_SHOW_FILTERS')"
          @click="showFilters = !showFilters"
        >
          <span class="i-as-filter" aria-hidden="true" />
        </button>
        {{ t("UI_TABLE_RECORDS", { count: totalCount }) }}
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
        {{ t("UI_CLEAR_ALL") }}
      </button>
    </div>
    <!-- One window-table chrome for every picker: the dictionary state above or the
         parent's in-memory one, both in context. `"multi"` renders the checkbox
         column; `"single"` none — Enter or a double-click picks. -->
    <AsWindowTable
      v-if="innerState"
      :select="select === 'multi' ? 'multi' : 'none'"
      :column-menu="{
        sort: true,
        filters: !!info,
        hide: false,
      }"
      v-on="pickListener"
    />
    <!-- A dictionary only: the inner table's column menu opens its own filter / config
         dialogs. The enum and distinct pickers have filters/hide disabled. -->
    <template v-if="info">
      <AsFilterDialog />
      <AsConfigDialog />
    </template>
  </div>
</template>
