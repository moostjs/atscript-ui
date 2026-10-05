<script setup lang="ts">
import { computed, ref } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { FilterCondition, ColumnFilterType } from "@atscript/ui-table";
import {
  columnFilter,
  hasSecondValue,
  isTemporalKind,
  NULL_OPS,
  temporalKind,
} from "@atscript/ui-table";
import AsFilterTemporalValue from "../internal/as-filter-temporal-value.vue";

/**
 * Default value input of a filter condition (`controls.filterInput`).
 *
 * `filterType` is the column's filter kind: `text`, `number`, `boolean`,
 * `enum` / `ref`, `date`, or `datetime` (since 0.1.148 — a column that stores
 * instants). A date column takes a native date input; a date-time column the
 * same plus a toggle that adds the time. A value that is a relative token
 * (`today-6`) or an epoch number shows as a pill instead of an input.
 */
const props = defineProps<{
  column: ColumnDef;
  condition: FilterCondition;
  filterType: ColumnFilterType;
}>();

const emit = defineEmits<{
  (e: "update:condition", condition: FilterCondition): void;
}>();

const needsInput = computed(() => !NULL_OPS.has(props.condition.type));

const isBetween = computed(() => hasSecondValue(props.condition.type));

const isTemporal = computed(() => isTemporalKind(props.filterType));

// The time of day is on while any value already carries one (a link, a
// preset) — the precision round-trips through the value's shape.
const timeOn = ref(
  props.filterType === "datetime" &&
    props.condition.value.some((v) => temporalKind(v) === "minute"),
);

const temporalInputType = computed(() =>
  props.filterType === "datetime" && timeOn.value ? "datetime-local" : "date",
);

function toggleTime() {
  timeOn.value = !timeOn.value;
  // Keep each value the input could show: pad a day to midnight, or cut a
  // minute back to its day. Tokens stay as they are.
  const value = props.condition.value.map((v) => {
    const kind = temporalKind(v);
    if (timeOn.value && kind === "day") return `${String(v)}T00:00`;
    if (!timeOn.value && kind === "minute") return String(v).slice(0, 10);
    return v;
  });
  emit("update:condition", { ...props.condition, value });
}

function setValue(index: number, parsed: string | number | boolean) {
  const value = [...props.condition.value];
  value[index] = parsed;
  emit("update:condition", { ...props.condition, value });
}

function updateValue(index: number, raw: string) {
  // A number input: an empty box stays `""` — unfilled, no filter — never `0`;
  // text that is not a number (a whole one, for an integer column) leaves it unfilled too.
  setValue(
    index,
    props.filterType === "number" ? (columnFilter(props.column).coerce(raw) ?? "") : raw,
  );
}

function onBoolSelect(val: string) {
  const boolVal = val === "true";
  emit("update:condition", { ...props.condition, value: [boolVal] });
}

// Number columns get a number input; an integer steps by 1, a decimal by any amount.
const inputAttrs = computed(() => {
  if (props.filterType !== "number") return { type: "text" };
  const { valueKind } = props.column;
  return {
    type: "number",
    step: valueKind === "integer" ? "1" : valueKind === "decimal" ? "any" : undefined,
  };
});
</script>

<template>
  <!-- Null/notNull: render a plain layer-1 box the size of a filter input, no text. -->
  <div v-if="!needsInput" class="as-filter-input-disabled" aria-hidden="true" />

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

  <!-- Date / date-time: native inputs, a pill for a relative or epoch value -->
  <div v-else-if="isTemporal" class="as-filter-input-temporal">
    <div v-if="isBetween" class="as-filter-input-range">
      <AsFilterTemporalValue
        :column="column"
        :value="condition.value[0]"
        :input-type="temporalInputType"
        @update:value="setValue(0, $event)"
      />
      <span class="as-filter-input-range-sep">&ndash;</span>
      <AsFilterTemporalValue
        :column="column"
        :value="condition.value[1]"
        :input-type="temporalInputType"
        @update:value="setValue(1, $event)"
      />
    </div>
    <AsFilterTemporalValue
      v-else
      :column="column"
      :value="condition.value[0]"
      :input-type="temporalInputType"
      @update:value="setValue(0, $event)"
    />
    <button
      v-if="filterType === 'datetime'"
      type="button"
      class="as-filter-input-time-toggle"
      :class="{ 'as-filter-input-time-toggle-on': timeOn }"
      :aria-pressed="timeOn"
      aria-label="Pick a time"
      title="Pick a time"
      @click="toggleTime"
    >
      <span class="i-as-clock" aria-hidden="true" />
    </button>
  </div>

  <!-- Between: two inputs -->
  <div v-else-if="isBetween" class="as-filter-input-range">
    <input
      class="as-filter-input"
      v-bind="inputAttrs"
      :value="condition.value[0] ?? ''"
      placeholder="From"
      @input="updateValue(0, ($event.target as HTMLInputElement).value)"
    />
    <span class="as-filter-input-range-sep">&ndash;</span>
    <input
      class="as-filter-input"
      v-bind="inputAttrs"
      :value="condition.value[1] ?? ''"
      placeholder="To"
      @input="updateValue(1, ($event.target as HTMLInputElement).value)"
    />
  </div>

  <!-- Default: single input -->
  <input
    v-else
    class="as-filter-input"
    v-bind="inputAttrs"
    :value="condition.value[0] ?? ''"
    placeholder="Value..."
    @input="updateValue(0, ($event.target as HTMLInputElement).value)"
  />
</template>
