<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import { useAsAmount } from "../../composables/use-as-amount";

const props = defineProps<TAsComponentProps<number | null | undefined>>();

const { currency, currencySymbol, step, displayValue, setFromInput } = useAsAmount({
  modelValue: () => props.model.value,
  currencyCode: () => props.currencyCode,
  currencyRefField: () => props.currencyRefField,
  precisionScale: () => props.precisionScale,
  onCommit: (v) => {
    props.model.value = v;
  },
});
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <div class="as-amount-wrap">
        <span v-if="currencySymbol" class="as-amount-prefix" :title="currency" aria-hidden="true">
          {{ currencySymbol }}
        </span>
        <input
          :id="inputId"
          class="as-amount-input"
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
      </div>
    </template>
  </AsFieldShell>
</template>
