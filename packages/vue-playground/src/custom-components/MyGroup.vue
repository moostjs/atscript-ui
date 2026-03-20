<script setup lang="ts">
import type { FormObjectFieldDef } from "@atscript/ui-core";
import { isObjectField } from "@atscript/ui-core";
import type { TAsComponentProps } from "@atscript/vue-form";
import { AsIterator } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps>();

const objectDef = isObjectField(props.field!)
  ? (props.field as FormObjectFieldDef).objectDef
  : undefined;
</script>

<template>
  <div class="cg-group">
    <div class="cg-header" v-if="title || onRemove">
      <div class="cg-title-row">
        <div v-if="title" class="cg-title">{{ title }}</div>
        <div v-if="error" class="cg-error">{{ error }}</div>
      </div>
      <button
        v-if="onRemove"
        type="button"
        class="cg-remove"
        :disabled="!canRemove"
        @click="onRemove"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        {{ removeLabel || "Remove" }}
      </button>
    </div>
    <div class="cg-content">
      <AsIterator v-if="objectDef" :def="objectDef" />
    </div>
  </div>
</template>

<style scoped>
.cg-group {
  border: 1.5px solid #e0e7ff;
  border-radius: 10px;
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%);
  overflow: hidden;
}

.cg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%);
  border-bottom: 1.5px solid #e0e7ff;
}

.cg-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.cg-title {
  font-size: 13px;
  font-weight: 700;
  color: #4338ca;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cg-error {
  font-size: 12px;
  color: #ef4444;
}

.cg-content {
  padding: 12px 14px;
}

.cg-remove {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1.5px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: #7c3aed;
  cursor: pointer;
  transition: all 0.15s;
}

.cg-remove:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #ef4444;
}

.cg-remove:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
