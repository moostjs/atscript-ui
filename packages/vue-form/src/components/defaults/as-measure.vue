<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import { useAsMeasure } from "../../composables/use-as-measure";

const props = defineProps<TAsComponentProps<number | null | undefined>>();

const { unit, step, displayValue, setFromInput } = useAsMeasure({
  modelValue: () => props.model.value,
  unitCode: () => props.unitCode,
  unitRefField: () => props.unitRefField,
  precisionScale: () => props.precisionScale,
  onCommit: (v) => {
    props.model.value = v;
  },
});
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <div class="as-measure-wrap">
        <input
          :id="inputId"
          class="as-measure-input"
          type="number"
          inputmode="decimal"
          :value="displayValue"
          @input="(e) => setFromInput((e.target as HTMLInputElement).value)"
          @blur="onBlur"
          :placeholder="placeholder"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :step="step"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
        />
        <span v-if="unit" class="as-measure-suffix" aria-hidden="true">
          {{ unit }}
        </span>
      </div>
    </template>
  </AsFieldShell>
</template>
