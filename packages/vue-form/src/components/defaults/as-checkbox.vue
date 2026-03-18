<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";

defineProps<TAsComponentProps>();
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="as-checkbox-field" id-prefix="as-checkbox">
    <template #header="{ optionalEnabled }">
      <span v-if="optional && !optionalEnabled" class="as-field-label">{{ label }}</span>
    </template>
    <template #default="{ inputId, errorId, descId }">
      <label :for="inputId">
        <input
          :id="inputId"
          type="checkbox"
          :checked="!!model.value"
          @change="
            model.value = ($event.target as HTMLInputElement).checked;
            onBlur();
          "
          @blur="onBlur"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-invalid="!!error || undefined"
          :aria-describedby="error || hint ? errorId : description ? descId : undefined"
        />
        {{ label }}
      </label>
    </template>
    <template #after-input="{ descId }">
      <span v-if="description" :id="descId">{{ description }}</span>
    </template>
  </AsFieldShell>
</template>
