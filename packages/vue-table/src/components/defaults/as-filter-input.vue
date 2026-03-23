<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui-core";
import type { FilterCondition, FilterConditionType, ColumnFilterType } from "@atscript/ui-table";
import { hasSecondValue } from "@atscript/ui-table";
import {
  CheckboxRoot,
  CheckboxIndicator,
  TagsInputRoot,
  TagsInputItem,
  TagsInputItemText,
  TagsInputItemDelete,
  TagsInputInput,
} from "reka-ui";

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

const isSetCondition = computed(() => {
  const t = props.condition.type;
  return t === "in" || t === "nin";
});

const isEnumSet = computed(
  () =>
    props.filterType === "enum" &&
    isSetCondition.value &&
    props.column.options &&
    props.column.options.length > 0,
);

const isBetween = computed(() => hasSecondValue(props.condition.type));

function updateValue(index: number, raw: string) {
  const value = [...props.condition.value];
  const parsed = props.filterType === "number" ? Number(raw) : raw;
  value[index] = parsed as string | number | boolean;
  emit("update:condition", { ...props.condition, value });
}

function onEnumToggle(key: string, checked: boolean) {
  const current = props.condition.value as string[];
  const next = checked ? [...current, key] : current.filter((v) => v !== key);
  emit("update:condition", { ...props.condition, value: next });
}

function onBoolSelect(val: string) {
  const boolVal = val === "true";
  emit("update:condition", { ...props.condition, value: [boolVal] });
}

const tagsValue = computed({
  get: () => (props.condition.value as string[]).filter((v) => v != null && v !== ""),
  set: (val: string[]) => {
    emit("update:condition", { ...props.condition, value: val });
  },
});

const inputType = computed(() => {
  if (props.filterType === "number") return "number";
  if (props.filterType === "date") return "date";
  return "text";
});
</script>

<template>
  <!-- No input needed for null/notNull -->
  <template v-if="!needsInput" />

  <!-- Enum checkboxes for in/nin -->
  <div v-else-if="isEnumSet" class="as-filter-enum-options">
    <label v-for="opt in column.options" :key="opt.key" class="as-filter-checkbox">
      <CheckboxRoot
        :checked="(condition.value as string[]).includes(opt.key)"
        class="as-filter-checkbox-root"
        @update:checked="(v: boolean) => onEnumToggle(opt.key, v)"
      >
        <CheckboxIndicator class="as-filter-checkbox-indicator"> &#x2713; </CheckboxIndicator>
      </CheckboxRoot>
      <span class="as-filter-checkbox-label">{{ opt.label }}</span>
    </label>
  </div>

  <!-- Tags input for free-text in/nin sets -->
  <TagsInputRoot v-else-if="isSetCondition" v-model="tagsValue" class="as-filter-tags">
    <TagsInputItem v-for="item in tagsValue" :key="item" :value="item" class="as-filter-tags-item">
      <TagsInputItemText class="as-filter-tags-item-text">
        {{ item }}
      </TagsInputItemText>
      <TagsInputItemDelete class="as-filter-tags-item-delete"> &times; </TagsInputItemDelete>
    </TagsInputItem>
    <TagsInputInput class="as-filter-tags-input" :placeholder="'Add value...'" />
  </TagsInputRoot>

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

  <!-- Enum select for eq/ne -->
  <select
    v-else-if="filterType === 'enum' && column.options && column.options.length > 0"
    class="as-filter-input as-filter-select"
    :value="String(condition.value[0] ?? '')"
    @change="updateValue(0, ($event.target as HTMLSelectElement).value)"
  >
    <option value="" disabled>Select...</option>
    <option v-for="opt in column.options" :key="opt.key" :value="opt.key">
      {{ opt.label }}
    </option>
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
