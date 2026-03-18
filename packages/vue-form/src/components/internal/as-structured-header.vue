<script setup lang="ts">
import type { TAsUnionContext } from "../types";
import AsVariantPicker from "./as-variant-picker.vue";

const props = defineProps<{
  title?: string;
  level?: number;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
  optional?: boolean;
  optionalEnabled?: boolean;
  onToggleOptional?: (enable: boolean) => void;
  disabled?: boolean;
  unionContext?: TAsUnionContext;
}>();

// ── Variant picker (from union context prop) ────────────────
const hasVariantPicker = props.unionContext !== undefined && props.unionContext.variants.length > 1;
</script>

<template>
  <div class="as-structured-header" v-if="title || onRemove || optional || hasVariantPicker">
    <div class="as-structured-header-content">
      <h2 v-if="title && level === 0" class="as-structured-title as-form-title">{{ title }}</h2>
      <h3 v-else-if="title" class="as-structured-title">{{ title }}</h3>

      <!-- Union variant picker — inline next to title -->
      <AsVariantPicker
        v-if="hasVariantPicker"
        :union-context="unionContext!"
        :disabled="disabled"
      />
    </div>

    <button
      v-if="optional && optionalEnabled"
      type="button"
      class="as-optional-clear"
      @click="onToggleOptional?.(false)"
    >
      &times;
    </button>
    <button
      v-if="onRemove"
      type="button"
      class="as-structured-remove-btn"
      :disabled="!canRemove"
      :aria-label="removeLabel || 'Remove item'"
      @click="onRemove"
    >
      {{ removeLabel || "Remove" }}
    </button>
  </div>
</template>

<style>
.as-structured-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.as-structured-header-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.as-structured-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}

.as-structured-title.as-form-title {
  font-size: 20px;
  font-weight: 700;
  color: #1d1d1f;
}

.as-structured-remove-btn {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  flex-shrink: 0;
}

.as-structured-remove-btn:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.as-structured-remove-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
