<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { ColumnDef, ValueHelpInfo } from "@atscript/ui";
import { str, ValueHelpClient } from "@atscript/ui";
import { debounce } from "@atscript/ui-table";
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

const emit = defineEmits<{
  (e: "remove"): void;
}>();

const { state } = useTableContext();
const info = props.column.valueHelpInfo as ValueHelpInfo;

const factory = getDefaultClientFactory();
if (!factory)
  throw new Error("ValueHelpClient requires a client factory set via setDefaultClientFactory().");
const vhClient = new ValueHelpClient(factory(info.path));

const innerState = useTable(info.path, {
  select: "none",
  queryOnMount: true,
  limit: 10,
});

const dictPaths = new Set(
  [...info.primaryKeys, info.labelField, info.descrField, ...info.attrFields].filter(
    Boolean,
  ) as string[],
);
const dictColumns = computed(() =>
  innerState.allColumns.value.filter((c) => dictPaths.has(c.path)),
);

const selectedValues = ref<unknown[]>([]);

const existing = state.filters.value[props.column.path];
if (existing) {
  for (const cond of existing) {
    if (cond.type === "in" || cond.type === "eq") {
      selectedValues.value = [...cond.value];
    }
  }
}

const labelCache = new Map<unknown, string>();

watch(
  () => innerState.results.value,
  (rows) => {
    for (const row of rows) {
      const key = row[info.targetField];
      if (key != null) {
        labelCache.set(key, str(row[info.labelField] ?? key));
      }
    }
  },
);

const chips = computed(() =>
  selectedValues.value.map((v) => ({
    value: v,
    label: labelCache.get(v) ?? str(v),
  })),
);

// Prevents the parent-sync watcher from echoing back changes we just made
let syncing = false;

watch(selectedValues, (values) => {
  syncing = true;
  if (values.length > 0) {
    state.setFieldFilter(props.column.path, [
      { type: "in", value: values as (string | number | boolean)[] },
    ]);
  } else {
    state.removeFieldFilter(props.column.path);
  }
  state.query();
  queueMicrotask(() => {
    syncing = false;
  });
});

watch(
  () => state.filters.value[props.column.path],
  (conditions) => {
    if (syncing) return;
    if (!conditions || conditions.length === 0) {
      if (selectedValues.value.length > 0) selectedValues.value = [];
      return;
    }
    const newValues: unknown[] = [];
    for (const cond of conditions) {
      if (cond.type === "in" || cond.type === "eq") {
        newValues.push(...cond.value);
      }
    }
    selectedValues.value = newValues;
  },
);

function rowValueFn(row: Record<string, unknown>): unknown {
  return row[info.targetField];
}

function displayValue(): string {
  return "";
}

const searchTerm = ref("");
const debouncedSearch = debounce(() => {
  void doSearch(searchTerm.value);
}, 300);

onBeforeUnmount(() => {
  debouncedSearch.cancel();
});

function onSearchInput(event: Event) {
  searchTerm.value = (event.target as HTMLInputElement).value;
  debouncedSearch();
}

async function doSearch(text: string) {
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
  // Close and reopen dropdown to force Combobox to re-evaluate items
  // (workaround for reka-ui/radix-vue not detecting async item changes)
  dropdownOpen.value = false;
  await nextTick();
  await nextTick();
  await nextTick();
  dropdownOpen.value = true;
}

const dropdownOpen = ref(false);

function removeChip(value: unknown) {
  selectedValues.value = selectedValues.value.filter((v) => v !== value);
}

function clearAll() {
  selectedValues.value = [];
}

function removeFilter() {
  clearAll();
  emit("remove");
}

function onBackspace() {
  if (searchTerm.value === "" && selectedValues.value.length > 0) {
    selectedValues.value = selectedValues.value.slice(0, -1);
  }
}
</script>

<template>
  <div class="as-filter-ref-inline">
    <span class="as-filter-ref-inline-label">{{ column.label }}</span>
    <div class="as-filter-ref-inline-field">
      <ComboboxRoot
        v-model="selectedValues"
        v-model:open="dropdownOpen"
        v-model:search-term="searchTerm"
        :display-value="displayValue"
        :filter-function="(val: unknown[]) => val"
        :multiple="true"
        :reset-search-term-on-blur="false"
        class="as-filter-ref-inline-combobox"
      >
        <ComboboxAnchor class="as-filter-ref-inline-input">
          <span v-for="chip in chips" :key="String(chip.value)" class="as-filter-ref-inline-chip">
            {{ chip.label }}
            <span
              class="as-filter-ref-inline-chip-remove"
              role="button"
              tabindex="-1"
              @click.stop.prevent="removeChip(chip.value)"
            >
              &times;
            </span>
          </span>

          <ComboboxInput
            class="as-filter-ref-inline-search"
            :placeholder="chips.length > 0 ? '' : 'Search...'"
            @input="onSearchInput"
            @keydown.backspace="onBackspace"
            @focus="dropdownOpen = true"
            as="input"
          />
        </ComboboxAnchor>

        <ComboboxContent
          class="as-filter-ref-dropdown"
          :side-offset="4"
          align="start"
          position="popper"
          @open-auto-focus.prevent
        >
          <ComboboxViewport>
            <AsTableBase
              as-combobox
              :row-value-fn="rowValueFn"
              :columns="dictColumns"
              :rows="innerState.results.value"
              :sorters="innerState.sorters.value"
              :querying="innerState.querying.value"
              :sticky-header="true"
            />
          </ComboboxViewport>

          <div v-if="selectedValues.length > 0" class="as-filter-ref-dropdown-footer">
            <button type="button" @click="clearAll">Reset</button>
          </div>
        </ComboboxContent>
      </ComboboxRoot>

      <span
        class="as-filter-ref-inline-remove"
        role="button"
        tabindex="-1"
        aria-label="Remove filter"
        @click="removeFilter"
      >
        &times;
      </span>
    </div>
  </div>
</template>
