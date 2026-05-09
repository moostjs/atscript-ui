<script setup lang="ts">
import type { TAsUnionContext } from "../types";
import AsOptionalClear from "./as-optional-clear.vue";
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

    <AsOptionalClear
      v-if="optional && optionalEnabled"
      @clear="onToggleOptional?.(false)"
    />
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
