<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";
import { useAsDate } from "../../composables/use-as-date";

const props = defineProps<TAsComponentProps<number | string | null | undefined>>();

const { inputType, displayValue, setFromInput } = useAsDate({
  modelValue: () => props.model.value,
  kind: "datetime",
  onCommit: (v) => {
    props.model.value = v;
  },
});
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <input
        :id="inputId"
        :type="inputType"
        :value="displayValue"
        @change="(e) => setFromInput((e.target as HTMLInputElement).value)"
        @blur="onBlur"
        :placeholder="placeholder"
        :name="name"
        :disabled="disabled"
        :readonly="readonly"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="ariaDescribedBy"
        :aria-label="!label ? name : undefined"
      />
    </template>
  </AsFieldShell>
</template>
