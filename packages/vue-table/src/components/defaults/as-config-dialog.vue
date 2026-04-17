<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import type { SortControl } from "@atscript/ui";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "reka-ui";
import type { ConfigTab } from "../../types";
import { useTableContext } from "../../composables/use-table-state";
import AsFieldsSelector from "./as-fields-selector.vue";
import AsSortersConfig from "./as-sorters-config.vue";

const { state } = useTableContext();

// Copy-on-open dialog models
const columnsModel = shallowRef<string[]>([]);
const filtersModel = shallowRef<string[]>([]);
const sortersModel = shallowRef<SortControl[]>([]);

const isOpen = computed({
  get: () => state.configDialogOpen.value,
  set: (val: boolean) => {
    state.configDialogOpen.value = val;
  },
});

const activeTab = computed({
  get: () => state.configTab.value,
  set: (val: string) => {
    state.configTab.value = val as ConfigTab;
  },
});

// On open: shallow-copy current state into dialog models
watch(isOpen, (open) => {
  if (open) {
    columnsModel.value = [...state.columnNames.value];
    filtersModel.value = [...state.filterFields.value];
    sortersModel.value = state.sorters.value.map((s) => ({ ...s }));
  }
});

const filterableColumns = computed(() => state.allColumns.value.filter((c) => c.filterable));
const sortableColumns = computed(() => state.allColumns.value.filter((c) => c.sortable));

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sortersEqual(a: SortControl[], b: SortControl[]): boolean {
  return (
    a.length === b.length &&
    a.every((v, i) => v.field === b[i].field && v.direction === b[i].direction)
  );
}

function onApply() {
  if (!arraysEqual(state.columnNames.value, columnsModel.value)) {
    state.setColumnNames(columnsModel.value);
  }
  if (!arraysEqual(state.filterFields.value, filtersModel.value)) {
    // Remove filter conditions for fields no longer in the list
    const newSet = new Set(filtersModel.value);
    for (const field of state.filterFields.value) {
      if (!newSet.has(field)) {
        state.removeFieldFilter(field);
      }
    }
    state.filterFields.value = filtersModel.value;
  }
  if (!sortersEqual(state.sorters.value, sortersModel.value)) {
    state.setSorters(sortersModel.value);
  }
  state.configDialogOpen.value = false;
  state.query();
}

function onCancel() {
  state.configDialogOpen.value = false;
}
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="as-config-dialog-overlay" />
      <DialogContent class="as-config-dialog-content">
        <TabsRoot v-model="activeTab" class="as-config-dialog-tabs">
          <div class="as-config-dialog-header">
            <DialogTitle class="as-config-dialog-title">Table Settings</DialogTitle>
            <TabsList class="as-config-tabs-list">
              <TabsTrigger value="columns" class="as-config-tab-trigger">Columns</TabsTrigger>
              <TabsTrigger value="filters" class="as-config-tab-trigger">Filters</TabsTrigger>
              <TabsTrigger value="sorters" class="as-config-tab-trigger">Sorters</TabsTrigger>
            </TabsList>
            <DialogClose class="as-config-dialog-close" aria-label="Close">&times;</DialogClose>
          </div>

          <TabsContent value="columns" class="as-config-tab-content">
            <AsFieldsSelector :columns="state.allColumns.value" v-model="columnsModel" />
          </TabsContent>

          <TabsContent value="filters" class="as-config-tab-content">
            <AsFieldsSelector :columns="filterableColumns" v-model="filtersModel" />
          </TabsContent>

          <TabsContent value="sorters" class="as-config-tab-content">
            <AsSortersConfig :columns="sortableColumns" v-model="sortersModel" />
          </TabsContent>
        </TabsRoot>

        <div class="as-config-dialog-footer">
          <button type="button" class="as-filter-btn" @click="onCancel">Cancel</button>
          <button type="button" class="as-filter-btn as-filter-btn-apply" @click="onApply">
            Apply
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
