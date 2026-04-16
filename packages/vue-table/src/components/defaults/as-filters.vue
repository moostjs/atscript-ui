<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { useTableContext } from "../../composables/use-table-state";
import AsFilterField from "./as-filter-field.vue";

const props = defineProps<{
  filterFields?: string[];
}>();

const { state } = useTableContext();

const columnMap = computed(() => {
  const tableDef = state.tableDef.value;
  if (!tableDef) return new Map<string, ColumnDef>();
  const map = new Map<string, ColumnDef>();
  for (const col of tableDef.columns) {
    map.set(col.path, col);
  }
  return map;
});

const activeColumns = computed(() => {
  const fields = props.filterFields ?? state.filterFields.value;
  const map = columnMap.value;
  if (map.size === 0) return [];
  const result: ColumnDef[] = [];
  for (const path of fields) {
    const col = map.get(path);
    if (col) result.push(col);
  }
  return result;
});
</script>

<template>
  <AsFilterField
    v-for="col in activeColumns"
    :key="col.path"
    :column="col"
    v-bind="$attrs"
  />
</template>
