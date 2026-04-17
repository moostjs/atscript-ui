<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import {
  columnFilterType,
  conditionLabel,
  conditionsForType,
  dateShortcuts,
  defaultCondition,
  type FilterCondition,
  type FilterConditionType,
} from "@atscript/ui-table";
import AsFilterInput from "./as-filter-input.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

const model = defineModel<FilterCondition[]>({ required: true });

const filterType = computed(() => columnFilterType(props.column.type));
const availableConditions = computed(() => conditionsForType(filterType.value));
const defCondition = computed<FilterConditionType>(() => defaultCondition(filterType.value));
const isDateType = computed(() => filterType.value === "date");
const shortcuts = computed(() => (isDateType.value ? dateShortcuts() : []));

function updateCondition(index: number, update: Partial<FilterCondition>) {
  model.value = model.value.map((c, i) => (i === index ? { ...c, ...update } : c));
}

function addCondition() {
  model.value = [...model.value, { type: defCondition.value, value: [] }];
}

function removeCondition(index: number) {
  const next = model.value.filter((_, i) => i !== index);
  model.value = next.length > 0 ? next : [{ type: defCondition.value, value: [] }];
}

function applyShortcut(dates: [string, string]) {
  model.value = [{ type: "bw", value: [dates[0], dates[1]] }];
}
</script>

<template>
  <div v-for="(cond, index) in model" :key="index" class="as-filter-condition-row">
    <select
      class="as-filter-condition-select"
      :value="cond.type"
      @change="
        updateCondition(index, {
          type: ($event.target as HTMLSelectElement).value as FilterConditionType,
          value: [],
        })
      "
    >
      <option v-for="ct in availableConditions" :key="ct" :value="ct">
        {{ conditionLabel(ct) }}
      </option>
    </select>

    <AsFilterInput
      :column="column"
      :condition="cond"
      :filter-type="filterType"
      @update:condition="(c) => updateCondition(index, c)"
    />

    <button
      v-if="model.length > 1"
      type="button"
      class="as-filter-condition-remove"
      aria-label="Remove condition"
      @click="removeCondition(index)"
    >
      &times;
    </button>
  </div>

  <button type="button" class="as-filter-add-condition" @click="addCondition">
    + Add condition
  </button>

  <div v-if="isDateType && shortcuts.length > 0" class="as-filter-shortcuts">
    <span class="as-filter-shortcuts-label">Quick:</span>
    <button
      v-for="sc in shortcuts"
      :key="sc.label"
      type="button"
      class="as-filter-shortcut-btn"
      @click="applyShortcut(sc.dates)"
    >
      {{ sc.label }}
    </button>
  </div>
</template>
