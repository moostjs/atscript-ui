<script setup lang="ts">
import { ref, watchEffect } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import AsOptionalClear from "../internal/as-optional-clear.vue";

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
        <label
          :for="inputId"
          class="as-field-label"
          :class="{ 'as-checkbox-indeterminate': model.value === undefined }"
        >
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
        <AsOptionalClear
          v-if="optional && model.value != null"
          @clear="onToggleOptional?.(false)"
        />
      </div>
    </template>
    <template #after-input="{ descId }">
      <div v-if="description" :id="descId" class="as-field-description">{{ description }}</div>
    </template>
  </AsFieldShell>
</template>
