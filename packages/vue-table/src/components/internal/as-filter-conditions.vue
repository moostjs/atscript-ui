<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import {
  columnFilter,
  conditionLabel,
  isTemporalKind,
  temporalShortcuts,
  type TemporalShortcut,
  type FilterCondition,
  type FilterConditionType,
} from "@atscript/ui-table";
import { useTableComponent } from "../../composables/use-table-component";
import AsFilterInput from "../defaults/as-filter-input.vue";

const props = defineProps<{
  column: ColumnDef;
}>();

// Static skin-slot resolution — `controls.filterInput ?? AsFilterInput`.
const FilterInput = useTableComponent("filterInput", AsFilterInput);

const model = defineModel<FilterCondition[]>({ required: true });

const spec = computed(() => columnFilter(props.column));
const filterType = computed(() => spec.value.kind);
const availableConditions = computed(() => spec.value.conditions);
const defCondition = computed(() => spec.value.defaultCondition);
// Relative conditions (`today-6`…`today`): a saved or shared filter keeps its meaning.
const allShortcuts = temporalShortcuts();
const shortcuts = computed(() => (isTemporalKind(filterType.value) ? allShortcuts : []));

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

function applyShortcut(sc: TemporalShortcut) {
  model.value = sc.conditions.map((c) => ({ type: c.type, value: [...c.value] }));
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
        {{ conditionLabel(ct, filterType) }}
      </option>
    </select>

    <component
      :is="FilterInput"
      :column="column"
      :condition="cond"
      :filter-type="filterType"
      @update:condition="(c: Partial<FilterCondition>) => updateCondition(index, c)"
    />

    <button
      type="button"
      class="as-filter-condition-remove"
      :disabled="model.length <= 1"
      :style="model.length <= 1 ? 'visibility:hidden' : ''"
      aria-label="Remove condition"
      @click="removeCondition(index)"
    >
      <span class="i-as-close" aria-hidden="true" />
    </button>
  </div>

  <button type="button" class="as-filter-add-condition" @click="addCondition">
    + Add condition
  </button>

  <div v-if="shortcuts.length > 0" class="as-filter-shortcuts">
    <span class="as-filter-shortcuts-label">Quick:</span>
    <button
      v-for="sc in shortcuts"
      :key="sc.id"
      type="button"
      class="as-filter-shortcut-btn"
      @click="applyShortcut(sc)"
    >
      {{ sc.label }}
    </button>
  </div>
</template>
