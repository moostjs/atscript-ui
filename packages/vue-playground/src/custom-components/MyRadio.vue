<script setup lang="ts">
import { useId } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<string>>();

const id = useId();
const groupId = `my-radio-${id}`;
const errorId = `my-radio-${id}-err`;

function optKey(opt: string | { key: string; label: string }): string {
  return typeof opt === "string" ? opt : opt.key;
}

function optLabel(opt: string | { key: string; label: string }): string {
  return typeof opt === "string" ? opt : opt.label;
}
</script>

<template>
  <div class="my-radio-field" :class="{ 'my-radio-field--error': !!error }" v-show="!hidden">
    <span v-if="label" :id="groupId" class="my-radio-label">
      {{ label }}
      <span v-if="required" class="my-radio-required">*</span>
    </span>
    <span v-if="description" class="my-radio-description">{{ description }}</span>
    <div class="my-radio-group" role="radiogroup" :aria-labelledby="groupId">
      <label
        v-for="opt in options"
        :key="optKey(opt)"
        class="my-radio-option"
        :class="{ 'my-radio-option--selected': optKey(opt) === model.value }"
      >
        <input
          type="radio"
          :value="optKey(opt)"
          :checked="optKey(opt) === model.value"
          @change="
            model.value = optKey(opt);
            onBlur();
          "
          :name="name"
          :disabled="disabled"
          class="my-radio-input"
        />
        <span class="my-radio-dot" />
        {{ optLabel(opt) }}
      </label>
    </div>
    <div class="my-radio-footer" v-if="error || hint">
      <span
        :id="errorId"
        :class="error ? 'my-radio-error' : 'my-radio-hint'"
        :role="error ? 'alert' : undefined"
      >
        {{ error || hint }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.my-radio-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}

.my-radio-label {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
}

.my-radio-required {
  color: #dc2626;
  margin-left: 2px;
}

.my-radio-description {
  font-size: 12px;
  color: #6b7280;
}

.my-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.my-radio-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 2px solid #93c5fd;
  border-radius: 20px;
  font-size: 13px;
  color: #1e293b;
  background: #eff6ff;
  cursor: pointer;
  transition: all 0.15s;
}

.my-radio-option:hover {
  border-color: #3b82f6;
}

.my-radio-option--selected {
  border-color: #3b82f6;
  background: #dbeafe;
  font-weight: 500;
  color: #1e40af;
}

.my-radio-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.my-radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #93c5fd;
  transition: all 0.15s;
}

.my-radio-option--selected .my-radio-dot {
  border-color: #3b82f6;
  background: #3b82f6;
}

.my-radio-footer {
  min-height: 16px;
}

.my-radio-hint {
  font-size: 12px;
  color: #6b7280;
}

.my-radio-error {
  font-size: 12px;
  color: #dc2626;
}
</style>
