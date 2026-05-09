<script setup lang="ts">
import { ref, watchEffect } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";

const props = defineProps<TAsComponentProps<boolean | undefined>>();

const inputRef = ref<HTMLInputElement | null>(null);

// HTML5 indeterminate is a property, not an attribute — sync via ref.
watchEffect(
  () => {
    if (inputRef.value) inputRef.value.indeterminate = props.model.value === undefined;
  },
  { flush: "post" },
);

function handleChange(e: Event) {
  props.model.value = (e.target as HTMLInputElement).checked;
}
</script>

<template>
  <AsFieldShell
    v-bind="$props"
    field-class="as-checkbox-field"
    id-prefix="as-checkbox"
    :chromeless="true"
  >
    <template #default="{ inputId, errorId, descId }">
      <div class="as-checkbox-row">
        <label :for="inputId" :class="{ 'as-checkbox-indeterminate': model.value === undefined }">
          <input
            ref="inputRef"
            :id="inputId"
            type="checkbox"
            :checked="model.value === true"
            @change="handleChange"
            @blur="onBlur"
            :name="name"
            :disabled="disabled"
            :readonly="readonly"
            :aria-invalid="!!error || undefined"
            :aria-describedby="error || hint ? errorId : description ? descId : undefined"
          />
          {{ label }}
        </label>
        <button
          v-if="optional && model.value !== undefined"
          type="button"
          class="as-optional-clear"
          aria-label="Clear value"
          @click="onToggleOptional?.(false)"
        >
          <span class="as-close-icon" aria-hidden="true" />
        </button>
      </div>
    </template>
    <template #after-input="{ descId }">
      <span v-if="description" :id="descId">{{ description }}</span>
    </template>
  </AsFieldShell>
</template>
