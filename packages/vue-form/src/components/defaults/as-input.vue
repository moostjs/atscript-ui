<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";

defineProps<TAsComponentProps>();
</script>

<template>
  <AsFieldShell v-bind="$props" id-prefix="as-input">
    <template #default="{ inputId, errorId, descId }">
      <input
        :id="inputId"
        v-model="model.value"
        @blur="onBlur"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :name="name"
        :type="type"
        :disabled="disabled"
        :readonly="readonly"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || hint ? errorId : description ? descId : undefined"
        :aria-label="!label ? name : undefined"
      />
    </template>
  </AsFieldShell>
</template>
