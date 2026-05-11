<script setup lang="ts">
import { computed, ref } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import { useAsMeasure } from "../../composables/use-as-measure";

/**
 * Default measure renderer — single input + trailing unit pill. Shares
 * the merged-chrome family with `AsAmount`; units aren't precision-
 * critical, so there's no integer/decimal split.
 */
const props = defineProps<TAsComponentProps<string | number | null | undefined>>();

const { unit, displayValue, rawValue, setFromInput } = useAsMeasure({
  modelValue: () => props.model.value,
  unitCode: () => props.unitCode,
  unitRefField: () => props.unitRefField,
  precisionScale: () => props.precisionScale,
  onCommit: (v) => {
    props.model.value = v;
  },
});

const focusActive = ref(false);
const fieldInput = ref<HTMLInputElement | null>(null);

const editValue = computed(() => (focusActive.value ? rawValue.value : displayValue.value));

function onFocus(): void {
  focusActive.value = true;
}

function onBlurField(): void {
  focusActive.value = false;
  props.onBlur();
}

function onInput(e: Event): void {
  setFromInput((e.target as HTMLInputElement).value);
}
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <div class="as-measure" :class="{ error: !!error, required }" :title="unit">
        <input
          :id="inputId"
          ref="fieldInput"
          class="as-measure-input"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :value="editValue"
          @input="onInput"
          @focus="onFocus"
          @blur="onBlurField"
          :placeholder="placeholder"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
        />
        <span v-if="unit" class="as-measure-unit" aria-hidden="true">{{ unit }}</span>
      </div>
    </template>
  </AsFieldShell>
</template>
