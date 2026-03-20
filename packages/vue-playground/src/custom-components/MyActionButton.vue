<script setup lang="ts">
import type { TAsComponentProps } from "@atscript/vue-form";

defineProps<TAsComponentProps<never>>();

const emit = defineEmits<{
  (e: "action", name: string): void;
}>();

function handleClick(action?: { id: string; label: string }) {
  if (action) {
    emit("action", action.id);
  }
}
</script>

<template>
  <button
    v-show="!hidden"
    type="button"
    class="custom-action-btn"
    :disabled="disabled"
    @click="handleClick(altAction)"
  >
    <span class="custom-action-btn-icon">⚡</span>
    {{ label }}
  </button>
</template>

<style scoped>
.custom-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 2px solid #f59e0b;
  border-radius: 8px;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
  cursor: pointer;
  transition: all 0.15s;
}

.custom-action-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-color: #d97706;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);
}

.custom-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.custom-action-btn-icon {
  font-size: 16px;
}
</style>
