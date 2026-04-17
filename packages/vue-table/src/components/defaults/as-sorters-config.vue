<script setup lang="ts">
import { computed, ref, reactive } from "vue";
import type { ColumnDef, SortControl } from "@atscript/ui";
import AsOrderableList from "./as-orderable-list.vue";

const props = defineProps<{
  columns: ColumnDef[];
  forceSorters?: SortControl[];
}>();

const externalModel = defineModel<SortControl[]>({ default: () => [] });

const forceSortersList = computed(() => props.forceSorters?.map((s) => s.field) ?? undefined);

const selected = ref<string[]>([
  ...(forceSortersList.value ?? []),
  ...externalModel.value.map((s) => s.field),
]);

const directionMap = reactive(new Map<string, "asc" | "desc">());
for (const s of externalModel.value) {
  directionMap.set(s.field, s.direction);
}
for (const s of props.forceSorters ?? []) {
  directionMap.set(s.field, s.direction);
}

const forceMap = (() => {
  const m = new Map<string, { direction: "asc" | "desc" }>();
  for (const s of props.forceSorters ?? []) {
    m.set(s.field, { direction: s.direction });
  }
  return m;
})();

function switchDirection(field: string) {
  if (forceMap.has(field)) return;
  const current = directionMap.get(field) ?? "asc";
  directionMap.set(field, current === "asc" ? "desc" : "asc");
  updateExternalModel();
}

function updateExternalModel() {
  externalModel.value = selected.value.map((field) => ({
    field,
    direction: directionMap.get(field) ?? "asc",
  }));
}

function onListUpdate(values: string[]) {
  selected.value = values;
  updateExternalModel();
}

const getLabel = (col: ColumnDef) => col.label;
const getValue = (col: ColumnDef) => col.path;
</script>

<template>
  <AsOrderableList
    :items="columns"
    :model-value="selected"
    :disabled="forceSortersList"
    :get-label="getLabel"
    :get-value="getValue"
    @update:model-value="onListUpdate"
  >
    <template #label="{ item, label, value }">
      <div class="as-sorter-label">
        <span class="as-orderable-list-item-label" :title="label">{{ label }}</span>
        <button
          v-if="selected.includes(value)"
          type="button"
          class="as-sorter-direction-btn"
          :class="{ 'as-sorter-direction-disabled': forceMap.has(value) }"
          :title="(directionMap.get(value) ?? 'asc') === 'desc' ? 'Descending' : 'Ascending'"
          @click.stop="switchDirection(value)"
        >
          {{ (directionMap.get(value) ?? "asc") === "desc" ? "&#x25BC;" : "&#x25B2;" }}
        </button>
      </div>
    </template>
    <template #item-extra="{ value }">
      <span v-if="forceMap.has(value)" class="as-sorter-lock" title="Locked">&#x1F512;</span>
    </template>
  </AsOrderableList>
</template>
