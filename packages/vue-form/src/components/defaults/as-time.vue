<script setup lang="ts">
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";
import AsAdornmentShell from "../internal/as-adornment-shell.vue";
import AsDateControl from "../internal/as-date-control.vue";
import { useAsDate } from "../../composables/use-as-date";

const props = defineProps<TAsComponentProps<number | string | null | undefined>>();

const { inputType, displayValue, setFromInput } = useAsDate({
  modelValue: () => props.model.value,
  kind: "time",
  onCommit: (v) => {
    props.model.value = v;
  },
});

const shellTitle = computed(() => props.currencyCode ?? props.unitCode ?? undefined);
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <AsAdornmentShell
        v-if="hasAdornment"
        :prefix-icon="prefixIcon"
        :prefix="prefix"
        :suffix="suffix"
        :suffix-icon="suffixIcon"
        :error="error"
        :required="required"
        :title="shellTitle"
      >
        <AsDateControl
          v-bind="$props"
          :input-id="inputId"
          :input-type="inputType"
          :display-value="displayValue"
          :set-from-input="setFromInput"
        />
      </AsAdornmentShell>
      <AsDateControl
        v-else
        v-bind="$props"
        :input-id="inputId"
        :input-type="inputType"
        :display-value="displayValue"
        :set-from-input="setFromInput"
      />
    </template>
  </AsFieldShell>
</template>
