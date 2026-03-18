<script setup lang="ts">
import type { FormArrayFieldDef } from "@atscript/ui-core";
import { isArrayField } from "@atscript/ui-core";
import { computed, ref } from "vue";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext } from "../../composables/use-form-context";
import { useFormArray } from "../../composables/use-form-array";
import { useDropdown } from "../../composables/use-dropdown";
import AsField from "../as-field.vue";
import AsNoData from "../internal/as-no-data.vue";
import AsStructuredHeader from "../internal/as-structured-header.vue";

const props = defineProps<TAsComponentProps>();

const arrayField = isArrayField(props.field!) ? (props.field as FormArrayFieldDef) : undefined;

// ── Union context: consume and clear for nested children ────
const unionCtx = useConsumeUnionContext();

const optionalEnabled = computed(() => Array.isArray(props.model?.value));

const {
  arrayValue,
  itemKeys,
  getItemField,
  isUnion,
  unionVariants,
  addItem,
  removeItem,
  canAdd,
  canRemove,
  addLabel,
  removeLabel,
} = useFormArray(
  arrayField!,
  computed(() => props.disabled ?? false),
);

// ── Union add dropdown ──────────────────────────────────────
const addDropdownRef = ref<HTMLElement | null>(null);
const { isOpen: addOpen, toggle: toggleAdd, select: selectAdd } = useDropdown(addDropdownRef);
</script>

<template>
  <div
    class="as-array"
    :class="{ 'as-array--root': level === 0, 'as-array--nested': (level ?? 0) > 0 }"
    v-show="!hidden"
  >
    <AsStructuredHeader
      :title="title"
      :level="level"
      :on-remove="onRemove"
      :can-remove="props.canRemove"
      :remove-label="props.removeLabel"
      :optional="optional"
      :optional-enabled="optionalEnabled"
      :on-toggle-optional="onToggleOptional"
      :disabled="disabled"
      :union-context="unionCtx"
    />

    <template v-if="optional && !optionalEnabled">
      <AsNoData :on-edit="() => onToggleOptional?.(true)" />
    </template>
    <template v-else>
      <!-- Items — each rendered as a single AsField -->
      <AsField
        v-for="(_item, i) in arrayValue"
        :key="itemKeys[i]"
        :field="getItemField(i)"
        :on-remove="() => removeItem(i)"
        :can-remove="canRemove"
        :remove-label="removeLabel"
        :array-index="i"
      />

      <!-- Add button -->
      <div class="as-array-add">
        <!-- Single type: simple add button -->
        <button
          v-if="!isUnion"
          type="button"
          class="as-array-add-btn"
          :disabled="!canAdd"
          @click="addItem(0)"
        >
          {{ addLabel }}
        </button>

        <!-- Union: single button with variant dropdown -->
        <div v-else ref="addDropdownRef" class="as-dropdown">
          <button type="button" class="as-array-add-btn" :disabled="!canAdd" @click="toggleAdd">
            {{ addLabel }} &#x25BE;
          </button>
          <div v-if="addOpen" class="as-dropdown-menu">
            <button
              v-for="(v, vi) in unionVariants"
              :key="vi"
              type="button"
              class="as-dropdown-item"
              @click="selectAdd(() => addItem(vi))"
            >
              {{ v.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Array-level validation error -->
      <div v-if="error" class="as-array-error" role="alert">{{ error }}</div>
    </template>
  </div>
</template>

<style>
.as-array {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 12px 0;
}

.as-array--nested {
  padding-left: 16px;
  border-left: 2px solid #d1d5db;
}

.as-array-error {
  font-size: 12px;
  color: #ef4444;
}

.as-array-add {
  margin-top: 4px;
}

.as-array-add-btn {
  padding: 6px 14px;
  border: 1px dashed #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
}

.as-array-add-btn:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}

.as-array-add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
