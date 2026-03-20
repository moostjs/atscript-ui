<script setup lang="ts">
import { useId } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

defineProps<TAsComponentProps<string>>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const id = useId();
const inputId = `my-input-${id}`;
const errorId = `my-input-${id}-err`;
const descId = `my-input-${id}-desc`;
</script>

<template>
  <div class="my-field" :class="{ 'my-field--error': !!error }" v-show="!hidden">
    <div class="my-header">
      <label v-if="label" class="my-label" :for="inputId">
        {{ label }}
        <span v-if="required" class="my-required">*</span>
      </label>
      <button
        v-if="onRemove"
        type="button"
        class="my-remove"
        :disabled="!canRemove"
        @click="onRemove"
      >
        &times;
      </button>
    </div>
    <span v-if="description" :id="descId" class="my-description">{{ description }}</span>
    <input
      :id="inputId"
      class="my-input"
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
    />
    <div class="my-footer" v-if="error || hint">
      <span
        :id="errorId"
        :class="error ? 'my-error' : 'my-hint'"
        :role="error ? 'alert' : undefined"
      >
        {{ error || hint }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.my-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}

.my-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.my-label {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
}

.my-required {
  color: #dc2626;
  margin-left: 2px;
}

.my-description {
  font-size: 12px;
  color: #6b7280;
}

.my-input {
  padding: 8px 12px;
  border: 2px solid #93c5fd;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  background: #eff6ff;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.my-input::placeholder {
  color: #93c5fd;
}

.my-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: #fff;
}

.my-field--error .my-input {
  border-color: #f87171;
  background: #fef2f2;
}

.my-input:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

.my-footer {
  min-height: 16px;
}

.my-hint {
  font-size: 12px;
  color: #6b7280;
}

.my-error {
  font-size: 12px;
  color: #dc2626;
}

.my-remove {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: #9ca3af;
  font-size: 16px;
  line-height: 1;
}

.my-remove:hover:not(:disabled) {
  color: #dc2626;
  border-color: #fca5a5;
}
</style>
