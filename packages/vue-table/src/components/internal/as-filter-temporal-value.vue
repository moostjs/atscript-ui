<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { formatColumnValue, temporalInputValue, temporalKind } from "@atscript/ui-table";
import { useCellLocale } from "../../composables/use-cell-locale";
import { useTableContext } from "../../composables/use-table-state";

/**
 * One date / date-time value of a filter condition. A value a native input can
 * hold (a day, or a minute while the time is on) renders as the input. Anything
 * else — a relative token (`today-6`, `month`), an epoch number, an ISO
 * instant — renders as a pill worded the way the chip words it; clicking the
 * pill turns it into the input, pre-filled with the day (or minute) it
 * resolves to in the table's time zone, and the `×` empties it.
 *
 * Internal to `<AsFilterInput>`.
 */
const props = defineProps<{
  column: ColumnDef;
  /** The condition's value (may be a token). */
  value: string | number | boolean | undefined;
  /** `date` or `datetime-local` — what the native input holds. */
  inputType: "date" | "datetime-local";
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "update:value", value: string): void;
}>();

const { state } = useTableContext();
const { locale } = useCellLocale();

const text = computed(() => (props.value === undefined ? "" : String(props.value)));

/** Whether the native input can show the value as is: a day, or a minute while the time is on. */
const editable = computed(() => {
  if (text.value === "") return true;
  const kind = typeof props.value === "string" ? temporalKind(props.value) : undefined;
  return kind === "day" || (kind === "minute" && props.inputType === "datetime-local");
});

const label = computed(
  () =>
    formatColumnValue(props.column, props.value, {
      locale: locale.value,
      timeZone: state.timeZone.value,
    }) ?? text.value,
);

const precision = computed(() => (props.inputType === "datetime-local" ? "minute" : "day"));

function edit() {
  const value = props.value;
  const resolved =
    typeof value === "string" || typeof value === "number"
      ? temporalInputValue(value, precision.value, { timeZone: state.timeZone.value })
      : undefined;
  emit("update:value", resolved ?? "");
}
</script>

<template>
  <input
    v-if="editable"
    class="as-filter-input"
    :type="inputType"
    :value="text"
    :placeholder="placeholder"
    @input="emit('update:value', ($event.target as HTMLInputElement).value)"
  />
  <span v-else class="as-filter-input-token" :title="text">
    <button type="button" class="as-filter-input-token-label" @click="edit">{{ label }}</button>
    <button
      type="button"
      class="as-filter-input-token-remove"
      aria-label="Clear value"
      @click="emit('update:value', '')"
    >
      <span class="i-as-close" aria-hidden="true" />
    </button>
  </span>
</template>
