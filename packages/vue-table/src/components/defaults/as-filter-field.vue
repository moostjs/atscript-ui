<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { ColumnDef, ValueHelpInfo } from "@atscript/ui";
import { ValueHelpClient } from "@atscript/ui";
import {
  debounce,
  isFilled,
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
import { useTable, getDefaultClientFactory } from "../../composables/use-table";
import AsTableBase from "../as-table-base.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

const { state } = useTableContext();

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
  if (!factory)
    throw new Error("AsFilterField requires a client factory set via setDefaultClientFactory().");
  vhClient = new ValueHelpClient(factory(info.path));

  innerState = useTable(info.path, {
    select: "none",
    queryOnMount: true,
    limit: 10,
    provideContext: false,
  });

  const dictPaths = new Set(
    [...info.primaryKeys, info.labelField, info.descrField, ...info.attrFields].filter(
      Boolean,
    ) as string[],
  );
  dictColumns = computed(() =>
    innerState!.allColumns.value.filter((c) => dictPaths.has(c.path)),
  );
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
      { path: "__key", label: "Value", type: "text", sortable: false, filterable: false, visible: true, order: 0 },
      { path: "__label", label: "Label", type: "text", sortable: false, filterable: false, visible: true, order: 1 },
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

// ── Chip model ───────────────────────────────────────────────
// Chips always derive from state.filters — no branching between
// dropdown and plain-input modes (matches not-sap pattern).

interface ChipItem {
  key: string;
  label: string;
  condition: FilterCondition;
}

// ── Dropdown: selectedValues for ComboboxRoot v-model ─────────
function extractEqValues(conditions: FilterCondition[] | undefined): unknown[] {
  if (!conditions || conditions.length === 0) return [];
  const values: unknown[] = [];
  for (const cond of conditions) {
    if (cond.type === "eq" && cond.value.length > 0 && cond.value[0] != null && cond.value[0] !== "") {
      values.push(cond.value[0]);
    }
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

const debouncedQuery = debounce(() => state.query(), 150);
onBeforeUnmount(() => debouncedQuery.cancel());

// Dropdown-only watchers: sync selectedValues ↔ eq conditions in state.filters
if (hasDropdown) {
  // Forward: selectedValues → state.filters (preserves non-eq conditions)
  watch(selectedValues, (values) => {
    const current = extractEqValues(state.filters.value[props.column.path]);
    if (arraysEqual(values, current)) return;

    const existing = state.filters.value[props.column.path] ?? [];
    const nonEq = existing.filter((c) => c.type !== "eq");
    const eqConditions = values.map((v) => ({ type: "eq" as const, value: [v as string | number | boolean] }));
    const merged = [...eqConditions, ...nonEq];

    if (merged.length > 0 && merged.some(isFilled)) {
      state.setFieldFilter(props.column.path, merged);
    } else {
      state.removeFieldFilter(props.column.path);
    }
    debouncedQuery();
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

const debouncedSearch = hasValueHelp
  ? debounce(() => {
      void doSearch(searchTerm.value);
    }, 300)
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
        String(row.__key ?? "").toLowerCase().includes(term) ||
        String(row.__label ?? "").toLowerCase().includes(term)
      );
    }
    return String(item).toLowerCase().includes(term);
  });
}

// ── Actions (unified — always operate on state.filters) ───
function removeChip(chip: ChipItem) {
  const existing = state.filters.value[props.column.path] ?? [];
  const remaining = existing.filter((c) => c !== chip.condition);
  if (remaining.length > 0 && remaining.some(isFilled)) {
    state.setFieldFilter(props.column.path, remaining);
  } else {
    state.removeFieldFilter(props.column.path);
  }
  debouncedQuery();
}

function clearAll() {
  state.removeFieldFilter(props.column.path);
  debouncedQuery();
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
  debouncedQuery();
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
  debouncedQuery();
}
</script>

<template>
  <div class="as-filter-field">
    <span class="as-filter-field-label">{{ column.label }}</span>
    <div class="as-filter-field-body">
      <ComboboxRoot
        v-if="hasDropdown"
        v-model="selectedValues"
        v-model:open="dropdownOpen"
        v-model:search-term="searchTerm"
        :display-value="displayValue"
        :filter-function="hasOptions ? filterFunction : (val: unknown[]) => val"
        :multiple="true"
        :reset-search-term-on-blur="false"
      >
        <ComboboxAnchor class="as-filter-field-input">
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

          <ComboboxInput
            class="as-filter-field-search"
            :placeholder="chips.length > 0 ? '' : 'Search...'"
            @input="onSearchInput"
            @keydown.backspace="onBackspace"
            @focus="dropdownOpen = true"
            as="input"
          />
        </ComboboxAnchor>

        <ComboboxContent
          class="as-filter-field-dropdown"
          :side-offset="4"
          align="start"
          position="popper"
          @open-auto-focus.prevent
        >
          <ComboboxViewport>
            <AsTableBase
              as-combobox
              :row-value-fn="rowValueFn"
              :columns="dropdownColumns"
              :rows="dropdownRows"
              :sorters="[]"
              :querying="dropdownQuerying"
              :sticky-header="true"
            />
          </ComboboxViewport>

          <div
            v-if="chips.length > 0 || (innerState && innerState.totalCount.value > 10)"
            class="as-filter-field-dropdown-footer"
          >
            <button v-if="chips.length > 0" type="button" @click="clearAll">
              Reset
            </button>
            <button
              v-if="innerState && innerState.totalCount.value > 10"
              type="button"
              @click="openFilterDialog"
            >
              See All ({{ innerState.totalCount.value }})
            </button>
          </div>
        </ComboboxContent>
      </ComboboxRoot>

      <!-- Plain input (no dropdown) -->
      <div v-else class="as-filter-field-input">
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
        <input
          class="as-filter-field-search"
          :placeholder="chips.length > 0 ? '' : 'Type value + Enter'"
          :value="searchTerm"
          @input="searchTerm = ($event.target as HTMLInputElement).value"
          @keydown.backspace="onBackspace"
          @keydown.enter.prevent="onEnter"
        />
      </div>

      <button
        type="button"
        class="as-filter-field-f4"
        aria-label="Open filter dialog"
        @click="openFilterDialog"
      >
        &#x2026;
      </button>
    </div>
  </div>
</template>
