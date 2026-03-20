<script setup lang="ts">
import { useId } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

defineProps<TAsComponentProps>();

const id = useId();
const inputId = `my-checkbox-${id}`;
const errorId = `my-checkbox-${id}-err`;
</script>

<template>
  <div class="my-checkbox-field" :class="{ 'my-checkbox-field--error': !!error }" v-show="!hidden">
    <label :for="inputId" class="my-checkbox-label">
      <span class="my-checkbox-track" :class="{ 'my-checkbox-track--on': !!model.value }">
        <span class="my-checkbox-thumb" />
      </span>
      <input
        :id="inputId"
        type="checkbox"
        :checked="!!model.value"
        @change="
          model.value = ($event.target as HTMLInputElement).checked;
          onBlur();
        "
        :name="name"
        :disabled="disabled"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || hint ? errorId : undefined"
        class="my-checkbox-input"
      />
      {{ label }}
    </label>
    <div class="my-checkbox-footer" v-if="error || hint">
      <span
        :id="errorId"
        :class="error ? 'my-checkbox-error' : 'my-checkbox-hint'"
        :role="error ? 'alert' : undefined"
      >
        {{ error || hint }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.my-checkbox-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}

.my-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #1e293b;
  cursor: pointer;
}

.my-checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.my-checkbox-track {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background: #cbd5e1;
  transition: background 0.2s;
  flex-shrink: 0;
}

.my-checkbox-track--on {
  background: #3b82f6;
}

.my-checkbox-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
}

.my-checkbox-track--on .my-checkbox-thumb {
  transform: translateX(16px);
}

.my-checkbox-footer {
  min-height: 16px;
}

.my-checkbox-hint {
  font-size: 12px;
  color: #6b7280;
}

.my-checkbox-error {
  font-size: 12px;
  color: #dc2626;
}
</style>
