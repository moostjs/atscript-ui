<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { FilterCondition, FilterConditionType, ColumnFilterType } from "@atscript/ui-table";
import { hasSecondValue } from "@atscript/ui-table";

const props = defineProps<{
  column: ColumnDef;
  condition: FilterCondition;
  filterType: ColumnFilterType;
}>();

const emit = defineEmits<{
  (e: "update:condition", condition: FilterCondition): void;
}>();

const needsInput = computed(() => {
  const t = props.condition.type;
  return t !== "null" && t !== "notNull";
});

const isBetween = computed(() => hasSecondValue(props.condition.type));

function updateValue(index: number, raw: string) {
  const value = [...props.condition.value];
  const parsed = props.filterType === "number" ? Number(raw) : raw;
  value[index] = parsed as string | number | boolean;
  emit("update:condition", { ...props.condition, value });
}

function onBoolSelect(val: string) {
  const boolVal = val === "true";
  emit("update:condition", { ...props.condition, value: [boolVal] });
}

const inputType = computed(() => {
  if (props.filterType === "number") return "number";
  if (props.filterType === "date") return "date";
  return "text";
});
</script>

<template>
  <!-- No input needed for null/notNull -->
  <template v-if="!needsInput" />

  <!-- Boolean select -->
  <select
    v-else-if="filterType === 'boolean'"
    class="as-filter-input as-filter-select"
    :value="String(condition.value[0] ?? '')"
    @change="onBoolSelect(($event.target as HTMLSelectElement).value)"
  >
    <option value="" disabled>Select...</option>
    <option value="true">true</option>
    <option value="false">false</option>
  </select>

  <!-- Between: two inputs -->
  <div v-else-if="isBetween" class="as-filter-input-range">
    <input
      class="as-filter-input"
      :type="inputType"
      :value="condition.value[0] ?? ''"
      placeholder="From"
      @input="updateValue(0, ($event.target as HTMLInputElement).value)"
    />
    <span class="as-filter-input-range-sep">&ndash;</span>
    <input
      class="as-filter-input"
      :type="inputType"
      :value="condition.value[1] ?? ''"
      placeholder="To"
      @input="updateValue(1, ($event.target as HTMLInputElement).value)"
    />
  </div>

  <!-- Default: single input -->
  <input
    v-else
    class="as-filter-input"
    :type="inputType"
    :value="condition.value[0] ?? ''"
    :placeholder="filterType === 'date' ? '' : 'Value...'"
    @input="updateValue(0, ($event.target as HTMLInputElement).value)"
  />
</template>
