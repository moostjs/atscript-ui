<script setup lang="ts">
import { useId } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<string>>();

const id = useId();
const labelId = `my-select-${id}-label`;
const errorId = `my-select-${id}-err`;

function optKey(opt: string | { key: string; label: string }): string {
  return typeof opt === "string" ? opt : opt.key;
}

function optLabel(opt: string | { key: string; label: string }): string {
  return typeof opt === "string" ? opt : opt.label;
}
</script>

<template>
  <div class="my-field" :class="{ 'my-field--error': !!error }" v-show="!hidden">
    <label v-if="label" :id="labelId" class="my-label">
      {{ label }}
      <span v-if="required" class="my-required">*</span>
    </label>
    <span v-if="description" class="my-description">{{ description }}</span>
    <select
      class="my-select"
      :value="model.value"
      @change="
        model.value = ($event.target as HTMLSelectElement).value;
        onBlur();
      "
      :name="name"
      :disabled="disabled"
      :aria-labelledby="label ? labelId : undefined"
      :aria-required="required || undefined"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error || hint ? errorId : undefined"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="optKey(opt)" :value="optKey(opt)">
        {{ optLabel(opt) }}
      </option>
    </select>
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

.my-select {
  padding: 8px 12px;
  border: 2px solid #93c5fd;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  background: #eff6ff;
  outline: none;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.my-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: #fff;
}

.my-field--error .my-select {
  border-color: #f87171;
  background: #fef2f2;
}

.my-select:disabled {
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
</style>
