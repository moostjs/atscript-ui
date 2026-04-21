<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { ColumnDef, ValueHelpInfo } from "@atscript/ui";
import { ValueHelpClient, valueHelpDictPaths, getDefaultClientFactory } from "@atscript/ui";
import {
  debounce,
  isFilled,
  isSimpleEq,
  columnFilterType,
  parseFilterInput,
  formatFilterCondition,
  type FilterCondition,
} from "@atscript/ui-table";
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxContent,
  ComboboxViewport,
} from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";
import { useTable } from "../../composables/use-table";
import { useDragScroll } from "../../composables/use-drag-scroll";
import AsTableBase from "../as-table-base.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

const { state } = useTableContext();

const chipsScrollEl = ref<HTMLElement | null>(null);
useDragScroll(chipsScrollEl);

// ── Determine column mode ──────────────────────────────────
const info = props.column.valueHelpInfo as ValueHelpInfo | undefined;
const hasValueHelp = !!info;
const hasOptions = !!(props.column.options && props.column.options.length > 0);
const hasDropdown = hasValueHelp || hasOptions;
const filterType = columnFilterType(props.column.type);

// ── Value help (FK columns) ────────────────────────────────
let vhClient: ValueHelpClient | undefined;
let innerState: ReturnType<typeof useTable> | undefined;
let dictColumns: ReturnType<typeof computed<ColumnDef[]>> | undefined;

if (hasValueHelp && info) {
  const factory = getDefaultClientFactory();
  vhClient = new ValueHelpClient(factory(info.path));

  innerState = useTable(info.path, {
    select: "none",
    queryOnMount: false,
    limit: 10,
    provideContext: false,
  });

  const dictPaths = valueHelpDictPaths(info);
  dictColumns = computed(() => innerState!.allColumns.value.filter((c) => dictPaths.has(c.path)));
}

// ── Enum options (static data for dropdown) ────────────────
const enumRows = hasOptions
  ? computed(() =>
      (props.column.options ?? []).map((opt) => ({
        __key: opt.key,
        __label: opt.label,
      })),
    )
  : undefined;

const enumColumns: ColumnDef[] | undefined = hasOptions
  ? [
      {
        path: "__label",
        label: "Value",
        type: "text",
        sortable: false,
        filterable: false,
        visible: true,
        order: 0,
      },
    ]
  : undefined;

// ── Dropdown rows & columns (unified) ──────────────────────
const dropdownRows = computed(() => {
  if (innerState) return innerState.results.value;
  if (enumRows) return enumRows.value;
  return [];
});

const dropdownColumns = computed(() => {
  if (dictColumns) return dictColumns.value;
  if (enumColumns) return enumColumns;
  return [];
});

const dropdownQuerying = computed(() => {
  if (innerState) return innerState.querying.value;
  return false;
});

const dropdownLoadingMetadata = computed(() => {
  if (innerState) return innerState.loadingMetadata.value;
  return false;
});

const seeAllCount = computed(() => {
  if (innerState) return innerState.totalCount.value;
  if (enumRows) return enumRows.value.length;
  return 0;
});

// ── Chip model ───────────────────────────────────────────────
// Chips always derive from state.filters — no branching between
// dropdown and plain-input modes (matches not-sap pattern).

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

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const selectedValues = ref<unknown[]>(
  hasDropdown ? extractEqValues(state.filters.value[props.column.path]) : [],
);

// Dropdown-only watchers: sync selectedValues ↔ eq conditions in state.filters
if (hasDropdown) {
  // Forward: selectedValues → state.filters (preserves non-eq conditions)
  watch(selectedValues, (values) => {
    const current = extractEqValues(state.filters.value[props.column.path]);
    if (arraysEqual(values, current)) return;

    const existing = state.filters.value[props.column.path] ?? [];
    const nonEq = existing.filter((c) => c.type !== "eq");
    const eqConditions = values.map((v) => ({
      type: "eq" as const,
      value: [v as string | number | boolean],
    }));
    const merged = [...eqConditions, ...nonEq];

    if (merged.some(isFilled)) {
      state.setFieldFilter(props.column.path, merged);
    } else {
      state.removeFieldFilter(props.column.path);
    }
  });

  // Reverse: state.filters → selectedValues (extract eq values only)
  watch(
    () => state.filters.value[props.column.path],
    (conditions) => {
      const newValues = extractEqValues(conditions);
      if (arraysEqual(newValues, selectedValues.value)) return;
      selectedValues.value = newValues;
    },
  );
}

// ── Chips computed (unified — always from state.filters) ──────
const chips = computed<ChipItem[]>(() => {
  const conditions = state.filters.value[props.column.path] ?? [];
  return conditions.filter(isFilled).map((cond, i) => ({
    key: `${cond.type}:${i}:${String(cond.value[0] ?? "")}`,
    label: formatFilterCondition(cond),
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
  if (hasValueHelp && info) return row[info.targetField];
  if (hasOptions) return row.__key;
  return undefined;
}

function displayValue(): string {
  return "";
}

// ── Search ─────────────────────────────────────────────────
const searchTerm = ref("");
const dropdownOpen = ref(false);

// Lazy first-fetch for FK value-help: only query when user opens the dropdown.
if (innerState) {
  watch(
    dropdownOpen,
    (open) => {
      if (open) innerState!.query();
    },
    { once: true },
  );
}

const debouncedSearch = hasValueHelp
  ? debounce(() => {
      void doSearch(searchTerm.value);
    }, 500)
  : undefined;

onBeforeUnmount(() => {
  debouncedSearch?.cancel();
});

function onSearchInput(event: Event) {
  searchTerm.value = (event.target as HTMLInputElement).value;
  if (hasValueHelp) {
    debouncedSearch!();
  }
}

async function doSearch(text: string) {
  if (!vhClient || !info || !innerState) return;
  innerState.querying.value = true;
  try {
    const result = await vhClient.search(info, {
      text: text || undefined,
      mode: "filter",
      limit: 10,
    });
    innerState.results.value = result.items;
  } catch {
    innerState.results.value = [];
  } finally {
    innerState.querying.value = false;
  }
  // Workaround: force Combobox to re-evaluate items
  dropdownOpen.value = false;
  await nextTick();
  await nextTick();
  await nextTick();
  dropdownOpen.value = true;
}

// ── Enum client-side filter ────────────────────────────────
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
  if (!dropdownOpen.value || !enumRows) return false;
  return filterFunction(enumRows.value).length === 0;
});

// ── Actions (unified — always operate on state.filters) ───
function removeChip(chip: ChipItem) {
  const existing = state.filters.value[props.column.path] ?? [];
  const remaining = existing.filter((c) => c !== chip.condition);
  if (remaining.some(isFilled)) {
    state.setFieldFilter(props.column.path, remaining);
  } else {
    state.removeFieldFilter(props.column.path);
  }
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

function onEnter() {
  if (hasDropdown || !searchTerm.value.trim()) return;

  const parsed = parseFilterInput(searchTerm.value, filterType);
  if (!parsed) return;

  // Append to existing filled conditions
  const existing = state.filters.value[props.column.path] ?? [];
  const filled = existing.filter(isFilled);
  state.setFieldFilter(props.column.path, [...filled, parsed]);
  searchTerm.value = "";
}
</script>

<template>
  <div class="as-filter-field" :aria-disabled="dropdownLoadingMetadata ? true : undefined">
    <span class="as-filter-field-label">{{ column.label }}</span>
    <div class="as-filter-field-body">
      <div v-if="dropdownLoadingMetadata" class="as-filter-field-loading">
        <span class="as-filter-field-loading-icon" aria-hidden="true" />
      </div>
      <ComboboxRoot
        v-else-if="hasDropdown"
        v-model="selectedValues"
        v-model:open="dropdownOpen"
        v-model:search-term="searchTerm"
        :display-value="displayValue"
        :filter-function="hasOptions ? filterFunction : (val: unknown[]) => val"
        :multiple="true"
        :reset-search-term-on-blur="false"
        as-child
      >
        <ComboboxAnchor as-child>
          <div class="as-filter-field-input" @click="dropdownOpen = true">
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
                class="as-filter-field-search"
                @input="onSearchInput"
                @keydown.backspace="onBackspace"
                @focus="
                  dropdownOpen = true;
                  scrollChipsToEnd();
                "
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
                as-combobox
                :row-value-fn="rowValueFn"
                :columns="dropdownColumns"
                :rows="dropdownRows"
                :sorters="[]"
                :querying="dropdownQuerying"
                :sticky-header="true"
                :column-menu="{ sort: false, filters: false, hide: false }"
              >
                <template #empty>
                  <div class="as-vh-empty">
                    <span class="as-vh-empty-icon i-as-search" aria-hidden="true" />
                    <p class="as-vh-empty-title">No matching values</p>
                    <p v-if="searchTerm" class="as-vh-empty-body">
                      No entries match <span class="as-vh-empty-code">"{{ searchTerm }}"</span>. Try
                      a different search.
                    </p>
                    <p v-else class="as-vh-empty-body">No entries available.</p>
                  </div>
                </template>
              </AsTableBase>
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
              <p v-else class="as-vh-empty-body">No entries available.</p>
            </div>
          </ComboboxViewport>

          <div v-if="chips.length > 0 || seeAllCount > 10" class="as-filter-field-dropdown-footer">
            <button v-if="chips.length > 0" type="button" @click="clearAll">Reset</button>
            <button v-if="seeAllCount > 10" type="button" @click="openFilterDialog">
              See All ({{ seeAllCount }})
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
          class="as-filter-field-search"
          :value="searchTerm"
          @input="searchTerm = ($event.target as HTMLInputElement).value"
          @keydown.backspace="onBackspace"
          @keydown.enter.prevent="onEnter"
          @focus="scrollChipsToEnd()"
        />
      </div>

      <button
        type="button"
        class="as-filter-field-f4"
        aria-label="Open filter dialog"
        @click="openFilterDialog"
      >
        <span class="i-as-value-help" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
