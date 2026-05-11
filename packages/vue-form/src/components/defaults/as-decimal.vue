<script setup lang="ts">
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import { useAsDecimal } from "../../composables/use-as-decimal";
import { useAsDualInput } from "../../composables/use-as-dual-input";

/**
 * Default decimal renderer — the "bank UX": one bordered shell with an
 * optional prefix pill, an integer input, a decimal separator pill, a
 * decimal input, and an optional suffix pill. Keyboard arrows bridge
 * between the two halves so typing a long decimal feels like a single
 * field.
 *
 * Currency-agnostic — when `prefix` is set by AsField (either from
 * `@ui.form.prefix`, `@ui.form.prefix.ref`, or the currency narrow
 * symbol), it renders as the leading pill. When `suffix` is set
 * (`@ui.form.suffix`, `@ui.form.suffix.ref`, or `@db.unit*`), it
 * renders as the trailing pill.
 *
 * All value math goes through `useAsDecimal`; all keyboard glue goes
 * through `useAsDualInput`. The SFC owns only render decisions.
 */
const props = defineProps<TAsComponentProps<string | number | null | undefined>>();

const { scale, decimalSeparator, rawValue, parts, setFromInput, setFromParts } = useAsDecimal({
  modelValue: () => props.model.value,
  scale: () => props.scale,
  storageScale: () => props.precisionScale,
  onCommit: (v) => {
    props.model.value = v;
  },
});

const {
  integerInput,
  decimalInput,
  integerDisplay,
  decimalDisplay,
  onIntegerFocus,
  onDecimalFocus,
  onBlurAll,
  onIntegerInput,
  onIntegerKeydown,
  onIntegerPaste,
  onDecimalInput,
  onDecimalKeydown,
  onDecimalPaste,
} = useAsDualInput({
  scale: () => scale.value,
  decimalSeparator: () => decimalSeparator.value,
  parts: () => parts.value,
  rawValue: () => rawValue.value,
  setFromParts,
  setFromInput,
  onBlur: () => props.onBlur(),
});

const isNegative = computed(() => parts.value.sign === "-");

// Title attribute prefers the currency code (so "USD" shows on hover) and
// falls back to the unit code. Adornment strings stay visible in the
// chrome pills, no need to repeat them in the tooltip.
const shellTitle = computed(() => props.currencyCode ?? props.unitCode ?? undefined);
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <div
        class="as-decimal"
        :class="{ 'as-decimal-negative': isNegative, error: !!error, required }"
        :title="shellTitle"
      >
        <span v-if="prefix" class="as-prefix" aria-hidden="true">{{ prefix }}</span>
        <input
          :id="inputId"
          ref="integerInput"
          class="as-decimal-integer"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :value="integerDisplay"
          @input="onIntegerInput"
          @keydown="onIntegerKeydown"
          @paste="onIntegerPaste"
          @focus="onIntegerFocus"
          @blur="onBlurAll"
          :placeholder="placeholder"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
        />
        <template v-if="scale > 0">
          <span class="as-decimal-sep" aria-hidden="true">{{ decimalSeparator }}</span>
          <input
            ref="decimalInput"
            class="as-decimal-decimal"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :value="decimalDisplay"
            :maxlength="scale"
            :size="scale"
            @input="onDecimalInput"
            @keydown="onDecimalKeydown"
            @paste="onDecimalPaste"
            @focus="onDecimalFocus"
            @blur="onBlurAll"
            :disabled="disabled"
            :readonly="readonly"
            :aria-label="`decimals of ${label ?? name ?? ''}`"
          />
        </template>
        <span v-if="suffix" class="as-suffix" aria-hidden="true">{{ suffix }}</span>
      </div>
    </template>
  </AsFieldShell>
</template>
