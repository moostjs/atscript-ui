<script setup lang="ts">
import { useId } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

defineProps<TAsComponentProps<string>>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const id = useId();
const inputId = `ct-star-${id}`;
const errorId = `ct-star-${id}-err`;
const descId = `ct-star-${id}-desc`;
</script>

<template>
  <div class="custom-star-input" :class="{ error: !!error }" v-show="!hidden">
    <label v-if="label" :for="inputId">{{ label }}</label>
    <span v-if="description" :id="descId" class="description">{{ description }}</span>

    <div class="input-wrapper">
      <span class="prefix" aria-hidden="true">⭐</span>
      <input
        :id="inputId"
        :value="model.value"
        @input="model.value = ($event.target as HTMLInputElement).value"
        @blur="onBlur"
        :placeholder="placeholder"
        :name="name"
        :type="type"
        :disabled="disabled"
        :readonly="readonly"
        :maxlength="maxLength"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || hint ? errorId : description ? descId : undefined"
        class="star-input"
      />
    </div>

    <div :id="errorId" class="error-hint" :role="error ? 'alert' : undefined">
      {{ error || hint }}
    </div>
  </div>
</template>

<style scoped>
.custom-star-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
}

.custom-star-input label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.custom-star-input .description {
  font-size: 12px;
  color: #6b7280;
}

.input-wrapper {
  display: flex;
  align-items: center;
  border: 2px solid #fbbf24;
  border-radius: 8px;
  background: #fffbeb;
  overflow: hidden;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.input-wrapper:focus-within {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

.custom-star-input.error .input-wrapper {
  border-color: #ef4444;
  background: #fef2f2;
}

.custom-star-input.error .input-wrapper:focus-within {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.prefix {
  padding: 8px 0 8px 12px;
  font-size: 16px;
  user-select: none;
}

.star-input {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: #1d1d1f;
  outline: none;
}

.star-input::placeholder {
  color: #9ca3af;
}

.star-input:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.error-hint {
  min-height: 16px;
  line-height: 16px;
  font-size: 12px;
  color: #6b7280;
}

.custom-star-input.error .error-hint {
  color: #ef4444;
}
</style>
