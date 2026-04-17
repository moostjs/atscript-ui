<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { valueHelpDictPaths } from "@atscript/ui";
import { debounce, isSimpleEq, type FilterCondition } from "@atscript/ui-table";
import { ListboxRoot } from "reka-ui";
import { useTable } from "../../composables/use-table";
import AsTableBase from "../as-table-base.vue";

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

const innerState = info
  ? useTable(info.path, {
      limit: 1000,
      select: "none",
      queryOnMount: true,
      provideContext: false,
    })
  : undefined;

const dictPaths = info ? valueHelpDictPaths(info) : undefined;
const dictColumns = computed<ColumnDef[]>(() => {
  if (!dictPaths || !innerState) return [];
  return innerState.allColumns.value.filter((c) => dictPaths.has(c.path));
});

const searchable = computed(() => !!innerState?.tableDef.value?.searchable);

const enumRows: Record<string, unknown>[] = options
  ? options.map((o) => ({ __value: o.key, __label: o.label }))
  : [];

const enumColumns: ColumnDef[] = [
  {
    path: "__label",
    label: "Value",
    type: "text",
    sortable: false,
    filterable: false,
    visible: true,
    order: 0,
  },
];

const searchTerm = ref("");

const debouncedFkSearch = innerState
  ? debounce(() => {
      innerState.searchTerm.value = searchTerm.value;
      innerState.query();
    }, 300)
  : undefined;

onBeforeUnmount(() => {
  debouncedFkSearch?.cancel();
});

function onSearchInput(event: Event) {
  searchTerm.value = (event.target as HTMLInputElement).value;
  debouncedFkSearch?.();
}

function onSearchEnter() {
  if (!innerState) return;
  innerState.searchTerm.value = searchTerm.value;
  innerState.query();
}

const filteredEnumRows = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return enumRows;
  return enumRows.filter((r) =>
    String(r.__label ?? "")
      .toLowerCase()
      .includes(term),
  );
});

function rowValueFn(row: Record<string, unknown>): unknown {
  if (info) return row[info.targetField];
  return row.__value;
}

const tableColumns = computed(() => (info ? dictColumns.value : enumColumns));
const tableRows = computed(() =>
  info ? (innerState?.results.value ?? []) : filteredEnumRows.value,
);
const querying = computed(() => innerState?.querying.value ?? false);
const totalCount = computed(() => (info ? (innerState?.totalCount.value ?? 0) : enumRows.length));

function onSelectAll() {
  selectedValues.value = tableRows.value.map(rowValueFn);
}

function onDeselectAll() {
  selectedValues.value = [];
}
</script>

<template>
  <div class="as-filter-value-help">
    <div class="as-filter-value-help-toolbar">
      <input
        v-if="!info || searchable"
        :value="searchTerm"
        type="text"
        class="as-filter-value-help-search"
        placeholder="Search..."
        autocomplete="off"
        @input="onSearchInput"
        @keydown.enter="onSearchEnter"
      />
      <span class="as-filter-value-help-count">{{ totalCount }} records</span>
    </div>

    <ListboxRoot
      v-model="selectedValues"
      :multiple="true"
      class="as-filter-value-help-table as-table-scroll-container"
    >
      <AsTableBase
        :columns="tableColumns"
        :rows="tableRows"
        :sorters="[]"
        :selected-rows="selectedValues"
        select="multi"
        :row-value-fn="rowValueFn"
        :querying="querying"
        :sticky-header="true"
        :stretch="false"
        @select-all="onSelectAll"
        @deselect-all="onDeselectAll"
      />
    </ListboxRoot>
  </div>
</template>
