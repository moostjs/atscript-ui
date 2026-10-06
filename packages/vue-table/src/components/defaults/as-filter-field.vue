<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from "vue";
import { until } from "@vueuse/core";
import type { ColumnDef, ResolvedValueHelp } from "@atscript/ui";
import {
  ValueHelpClient,
  getMetaEntry,
  optionValue,
  resolveValueHelp,
  valueHelpDictPaths,
} from "@atscript/ui";
import {
  arraysEqual,
  debounce,
  isFilled,
  isSimpleEq,
  columnFilterKind,
  isTemporalKind,
  parseColumnFilterInput,
  stableValueKey,
  type FilterCondition,
} from "@atscript/ui-table";
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxContent,
  ComboboxViewport,
} from "reka-ui";
import { useConditionFormat } from "../../composables/use-condition-format";
import { useTableContext } from "../../composables/use-table-state";
import { useTable } from "../../composables/use-table";
import {
  createDistinctPager,
  declineIfRejected,
  hasValuePicker,
  useDistinctPicker,
  valueColumn,
} from "../../composables/use-value-pickers";
import { useDragScroll } from "../../composables/use-drag-scroll";
import AsTableBase from "../internal/as-table-base.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

const { state } = useTableContext();
const { formatCondition } = useConditionFormat(state);
const isTemporal = computed(() => isTemporalKind(columnFilterKind(props.column)));

const chipsScrollEl = ref<HTMLElement | null>(null);
useDragScroll(chipsScrollEl);

// ── Determine column mode ──────────────────────────────────
// A dictionary target (FK or `@ui.valueHelp`) and the distinct values of the
// column itself (`@ui.valueHelp.distinct`) are separate pickers; a column has
// at most one of them, or literal options.
const info = props.column.valueHelpInfo;
const distinct = props.column.distinct;
const hasOptions = !!(props.column.options && props.column.options.length > 0);
const hasDropdown = computed(() => hasValuePicker(state, props.column));

let vhClient: ValueHelpClient | undefined;
let innerState: ReturnType<typeof useTable> | undefined;
const resolved = shallowRef<ResolvedValueHelp | null>(null);

if (info) {
  vhClient = new ValueHelpClient(getMetaEntry(info.url).client);

  innerState = useTable(info.url, {
    select: "none",
    queryOnMount: false,
    limit: 10,
    provideContext: false,
    // the binding's static scope + the committed field (since 0.1.148)
    forceFilters: info.filter,
    alwaysSelected: [info.targetField],
  });
}

// ── Distinct values (server-searched flat list) ─────────────
// One window-sized first page (shared with the dialog), the first 10 shown.
const DISTINCT_WINDOW = 100;
const DISTINCT_SHOWN = 10;
const distinctPicker = distinct
  ? useDistinctPicker(createDistinctPager(state, props.column), DISTINCT_WINDOW, DISTINCT_SHOWN)
  : undefined;

const dictColumns = computed<ColumnDef[]>(() => {
  if (!resolved.value || !innerState) return [];
  const paths = valueHelpDictPaths(resolved.value);
  const pinned = new Set(info?.pinned);
  return innerState.allColumns.value.filter((c) => paths.has(c.path) && !pinned.has(c.path));
});

async function ensureResolved(): Promise<ResolvedValueHelp | null> {
  if (resolved.value) return resolved.value;
  if (!info) return null;
  try {
    resolved.value = await resolveValueHelp(info.url);
    return resolved.value;
  } catch (err) {
    // The target answered 4xx (not readable for this caller): no picker, free text.
    declineIfRejected(state, info, err);
    return null;
  }
}

function kickoffResolve() {
  void ensureResolved();
}

// ── Enum options (static data for dropdown) ────────────────
const enumRows = hasOptions
  ? computed(() =>
      (props.column.options ?? []).map((opt) => ({
        __key: opt.key,
        __label: opt.label,
        // The typed literal (`true`, `3`) — what the server's filter accepts.
        __value: optionValue(opt),
      })),
    )
  : undefined;

const enumColumns: ColumnDef[] | undefined =
  hasOptions || distinct ? [valueColumn(false)] : undefined;

// ── Dropdown rows & columns (unified) ──────────────────────
const dropdownRows = computed(() => {
  if (innerState) return innerState.results.value;
  if (distinctPicker) return distinctPicker.rows.value;
  if (enumRows) return enumRows.value;
  return [];
});

const dropdownColumns = computed(() => {
  if (info) return dictColumns.value;
  if (enumColumns) return enumColumns;
  return [];
});

const dropdownQuerying = computed(() => {
  if (innerState) return innerState.querying.value;
  return distinctPicker?.querying.value ?? false;
});

const dropdownQueryError = computed<Error | null>(() => {
  if (innerState) return innerState.queryError.value;
  return distinctPicker?.error.value ?? null;
});

const dropdownLoadingMetadata = computed(() => {
  if (innerState) return innerState.loadingMetadata.value;
  return false;
});

const seeAllCount = computed(() => {
  if (innerState) return innerState.totalCount.value;
  // distinct: the dialog pages the rest — `count` is one past the window when more follow
  if (distinctPicker) return distinctPicker.count.value;
  if (enumRows) return enumRows.value.length;
  return 0;
});
/** "100+" when a distinct picker has more values than its first page (its count is one past it). */
const seeAllLabel = computed(() =>
  !innerState && distinctPicker?.more.value
    ? `${distinctPicker.count.value - 1}+`
    : String(seeAllCount.value),
);

// ── Chip model ───────────────────────────────────────────────
interface ChipItem {
  key: string;
  label: string;
  condition: FilterCondition;
}

function extractEqValues(conditions: FilterCondition[] | undefined): unknown[] {
  if (!conditions) return [];
  const values: unknown[] = [];
  for (const c of conditions) {
    if (isSimpleEq(c)) values.push(c.value[0]);
  }
  return values;
}

const dropdownCapable = !!info || hasOptions || !!distinct;
const selectedValues = ref<unknown[]>(
  dropdownCapable ? extractEqValues(state.filters.value[props.column.path]) : [],
);

if (dropdownCapable) {
  watch(selectedValues, (values) => {
    const current = extractEqValues(state.filters.value[props.column.path]);
    if (arraysEqual(values, current)) return;

    const existing = state.filters.value[props.column.path] ?? [];
    const nonEq = existing.filter((c) => c.type !== "eq");
    const eqConditions = values.map((v) => ({
      type: "eq" as const,
      value: [v as string | number | boolean],
    }));
    // `setFieldFilter` drops the field when nothing is filled.
    state.setFieldFilter(props.column.path, [...eqConditions, ...nonEq]);
  });

  watch(
    () => state.filters.value[props.column.path],
    (conditions) => {
      const newValues = extractEqValues(conditions);
      if (arraysEqual(newValues, selectedValues.value)) return;
      selectedValues.value = newValues;
    },
  );
}

const chips = computed<ChipItem[]>(() => {
  const conditions = state.filters.value[props.column.path] ?? [];
  return conditions.filter(isFilled).map((cond, i) => ({
    key: `${cond.type}:${i}:${String(cond.value[0] ?? "")}`,
    label: formatCondition(props.column, cond),
    condition: cond,
  }));
});

function scrollChipsToEnd() {
  void nextTick(() => {
    const el = chipsScrollEl.value;
    if (el) el.scrollLeft = el.scrollWidth;
  });
}

watch(
  () => chips.value.length,
  (len, prev) => {
    if (len > prev) scrollChipsToEnd();
  },
);

// ── Row value extraction ───────────────────────────────────
function rowValueFn(row: Record<string, unknown>): unknown {
  if (info) return row[info.targetField];
  if (hasOptions || distinct) return row.__value;
  return undefined;
}

const inputId = useId();
const searchTerm = ref("");
const dropdownOpen = ref(false);

if (innerState) {
  watch(
    dropdownOpen,
    async (open) => {
      if (!open) return;
      const r = await ensureResolved();
      // Wait for tableDef so allColumns is populated before we clamp columnNames.
      await until(() => innerState!.tableDef.value).toBeTruthy();
      // Clamp $select to the value-help dict paths — same shape the dialog
      // uses. Without this the dropdown's query carries every table column.
      // The columnNames watcher and the explicit query() coalesce into one
      // microtask-scheduled fetch (see use-table-state.ts scheduleQuery).
      if (r) {
        const dictPaths = valueHelpDictPaths(r);
        const dictCols = innerState!.allColumns.value.filter((c) => dictPaths.has(c.path));
        if (dictCols.length > 0) {
          innerState!.columnNames.value = dictCols.map((c) => c.path);
        }
      }
      innerState!.query();
    },
    { once: true },
  );
}

const serverSearch = !!info || !!distinct;
const debouncedSearch = serverSearch
  ? debounce(() => {
      void doSearch(searchTerm.value);
    }, 500)
  : undefined;

if (distinctPicker) {
  // A changed table scope makes the loaded values stale: the next open asks again.
  watch(
    () => stableValueKey(state.forceFilters.value ?? null),
    () => {
      distinctPicker.loaded.value = false;
    },
  );
  // First open loads the first page; typing re-queries the server.
  watch(dropdownOpen, (open) => {
    if (open && !distinctPicker.loaded.value && !distinctPicker.querying.value) {
      void distinctPicker.load("");
    }
  });
}

onBeforeUnmount(() => {
  debouncedSearch?.cancel();
});

function onSearchInput(event: Event) {
  searchTerm.value = (event.target as HTMLInputElement).value;
  if (serverSearch) {
    debouncedSearch!();
  }
}

async function doSearch(text: string) {
  if (distinctPicker) return distinctPicker.load(text);
  if (!vhClient || !innerState) return;
  const r = await ensureResolved();
  if (!r) return;
  innerState.querying.value = true;
  try {
    const result = await vhClient.search(r, {
      text: text || undefined,
      mode: "filter",
      limit: 10,
      filter: info?.filter,
      valueField: info?.targetField,
    });
    innerState.results.value = result.items;
    innerState.queryError.value = null;
  } catch (err) {
    innerState.results.value = [];
    innerState.queryError.value = err instanceof Error ? err : new Error(String(err));
  } finally {
    innerState.querying.value = false;
  }
}

function filterFunction(val: unknown[]): unknown[] {
  if (!hasOptions || !searchTerm.value) return val;
  const term = searchTerm.value.toLowerCase();
  return val.filter((item) => {
    if (typeof item === "object" && item !== null) {
      const row = item as Record<string, unknown>;
      return (
        String(row.__key ?? "")
          .toLowerCase()
          .includes(term) ||
        String(row.__label ?? "")
          .toLowerCase()
          .includes(term)
      );
    }
    return String(item).toLowerCase().includes(term);
  });
}

const noEnumMatches = computed(() => {
  if (!dropdownOpen.value) return false;
  if (distinctPicker) {
    return (
      !distinctPicker.querying.value &&
      !distinctPicker.error.value &&
      distinctPicker.rows.value.length === 0
    );
  }
  if (!enumRows) return false;
  return filterFunction(enumRows.value).length === 0;
});

function removeChip(chip: ChipItem) {
  const existing = state.filters.value[props.column.path] ?? [];
  state.setFieldFilter(
    props.column.path,
    existing.filter((c) => c !== chip.condition),
  );
}

function clearAll() {
  state.removeFieldFilter(props.column.path);
}

function openFilterDialog() {
  dropdownOpen.value = false;
  state.openFilterDialog(props.column);
}

function onBackspace() {
  if (searchTerm.value !== "" || chips.value.length === 0) return;
  const existing = state.filters.value[props.column.path] ?? [];
  const filled = existing.filter(isFilled);
  if (filled.length === 0) return;
  const remaining = filled.slice(0, -1);
  if (remaining.length > 0) {
    state.setFieldFilter(props.column.path, remaining);
  } else {
    state.removeFieldFilter(props.column.path);
  }
}

function onAnchorClick() {
  dropdownOpen.value = true;
  kickoffResolve();
}

function onInputFocus() {
  dropdownOpen.value = true;
  kickoffResolve();
  scrollChipsToEnd();
}

function onEnter() {
  if (hasDropdown.value || !searchTerm.value.trim()) return;

  const parsed = parseColumnFilterInput(searchTerm.value, props.column);
  if (!parsed) return;

  const existing = state.filters.value[props.column.path] ?? [];
  const filled = existing.filter(isFilled);
  state.setFieldFilter(props.column.path, [...filled, parsed]);
  searchTerm.value = "";
}

// F4 on the search input opens the same filter dialog the value-help
// button does. The button itself is `tabindex="-1"` so Tab moves cleanly
// from one filter input to the next (same pattern as SAP UI5 ValueHelp).
function onF4(event: KeyboardEvent) {
  event.preventDefault();
  openFilterDialog();
}
</script>

<template>
  <div class="as-filter-field" :aria-disabled="dropdownLoadingMetadata ? true : undefined">
    <label :for="inputId" class="as-filter-field-label">{{ column.label }}</label>
    <div class="as-filter-field-body">
      <div v-if="dropdownLoadingMetadata" class="as-filter-field-loading">
        <span class="as-filter-field-loading-icon" aria-hidden="true" />
      </div>
      <ComboboxRoot
        v-else-if="hasDropdown"
        v-model="selectedValues"
        v-model:open="dropdownOpen"
        :multiple="true"
        :reset-search-term-on-blur="false"
        :ignore-filter="serverSearch"
        as-child
      >
        <ComboboxAnchor as-child>
          <div class="as-filter-field-input" @click="onAnchorClick">
            <div ref="chipsScrollEl" class="as-filter-field-chips">
              <span v-for="chip in chips" :key="chip.key" class="as-filter-field-chip">
                {{ chip.label }}
                <span
                  class="as-filter-field-chip-remove"
                  role="button"
                  tabindex="-1"
                  @click.stop.prevent="removeChip(chip)"
                >
                  <span class="i-as-close" aria-hidden="true" />
                </span>
              </span>
            </div>

            <ComboboxInput as-child>
              <input
                :id="inputId"
                class="as-filter-field-search"
                @input="onSearchInput"
                @keydown.backspace="onBackspace"
                @keydown.f4="onF4"
                @focus="onInputFocus"
              />
            </ComboboxInput>
          </div>
        </ComboboxAnchor>

        <ComboboxContent
          class="as-filter-field-dropdown"
          :side-offset="4"
          align="start"
          position="popper"
          @open-auto-focus.prevent
        >
          <ComboboxViewport>
            <div class="as-filter-field-dropdown-body">
              <AsTableBase
                render-mode="combobox"
                :row-value-fn="rowValueFn"
                :columns="dropdownColumns"
                :rows="dropdownRows"
                :sorters="[]"
                :querying="dropdownQuerying"
                :query-error="dropdownQueryError"
                :search-term="searchTerm"
                :sticky-header="true"
                :column-menu="{ sort: false, filters: false, hide: false }"
              />
              <div v-if="dropdownQuerying" class="as-table-query-overlay">
                <span class="as-table-query-overlay-icon" aria-hidden="true" />
              </div>
            </div>
            <div v-if="noEnumMatches" class="as-vh-empty">
              <span class="as-vh-empty-icon i-as-search" aria-hidden="true" />
              <p class="as-vh-empty-title">No matching values</p>
              <p v-if="searchTerm" class="as-vh-empty-body">
                No entries match <span class="as-vh-empty-code">"{{ searchTerm }}"</span>. Try a
                different search.
              </p>
              <p v-else class="as-vh-empty-body">No entries available</p>
            </div>
          </ComboboxViewport>

          <div v-if="chips.length > 0 || seeAllCount > 10" class="as-filter-field-dropdown-footer">
            <button v-if="chips.length > 0" type="button" @click="clearAll">Reset</button>
            <button v-if="seeAllCount > 10" type="button" @click="openFilterDialog">
              See All ({{ seeAllLabel }})
              <span class="as-kbd">F4</span>
            </button>
          </div>
        </ComboboxContent>
      </ComboboxRoot>

      <!-- Plain input (no dropdown) -->
      <div v-else class="as-filter-field-input">
        <div ref="chipsScrollEl" class="as-filter-field-chips">
          <span v-for="chip in chips" :key="chip.key" class="as-filter-field-chip">
            {{ chip.label }}
            <span
              class="as-filter-field-chip-remove"
              role="button"
              tabindex="-1"
              @click.stop.prevent="removeChip(chip)"
            >
              &times;
            </span>
          </span>
        </div>
        <input
          :id="inputId"
          class="as-filter-field-search"
          :value="searchTerm"
          :placeholder="isTemporal ? 'YYYY-MM-DD' : undefined"
          @input="searchTerm = ($event.target as HTMLInputElement).value"
          @keydown.backspace="onBackspace"
          @keydown.enter.prevent="onEnter"
          @keydown.f4="onF4"
          @focus="scrollChipsToEnd()"
        />
      </div>

      <!-- `tabindex="-1"`: don't compete with the field's own input for tab
           order — Tab moves cleanly between filter fields, F4 on the input
           opens this dialog. Button stays click-target for mouse users. -->
      <button
        type="button"
        class="as-filter-field-f4"
        tabindex="-1"
        aria-label="Open filter dialog (F4)"
        title="Open filter dialog (F4)"
        @click="openFilterDialog"
      >
        <span class="i-as-value-help" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
