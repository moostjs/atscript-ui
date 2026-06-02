<script setup lang="ts">
import type { FormArrayFieldDef, FormFieldDef } from "@atscript/ui";
import { computed, ref, useTemplateRef } from "vue";
import type { TAsComponentProps } from "../types";
import { useAsUnionVariant } from "../../composables/use-form-context";
import { useAsArray } from "../../composables/use-as-array";
import { useAsDropdown } from "../../composables/use-as-dropdown";
import { useAsOptionalAddFlow } from "../../composables/use-as-optional-add-flow";
import AsField from "../as-field.vue";
import AsCollapsible from "../as-collapsible.vue";
import AsItemsChip from "../internal/as-items-chip.vue";
import AsArrayClearBtn from "../internal/as-array-clear-btn.vue";
import AsVariantPicker from "../internal/as-variant-picker.vue";

const props = defineProps<TAsComponentProps>();

const arrayField = props.field as FormArrayFieldDef;

// Cleared on consume so nested children don't re-render the picker.
const unionCtx = useAsUnionVariant();
const hasVariantPicker = computed(() => unionCtx !== undefined && unionCtx.variants.length > 1);

const optionalEnabled = computed(() => Array.isArray(props.model?.value));
const disabled = computed(() => props.disabled ?? false);

const {
  arrayValue,
  itemKeys,
  isUnion,
  unionVariants,
  isOptional,
  isEmpty,
  getItemField,
  addItem,
  removeItem,
  clear,
  canAdd,
  canRemove,
} = useAsArray(arrayField, disabled);

const level = computed(() => props.level ?? 0);

// `singularLabel` is pre-resolved upstream by AsField; fall back to "item"
// when the prop is missing (custom mounts that bypass AsField).
const singular = props.singularLabel ?? "item";

const defaultOpen = !isOptional;

const addDropdownRef = ref<HTMLElement | null>(null);
const { isOpen: addOpen, toggle: toggleAdd, select: selectAdd } = useAsDropdown(addDropdownRef);

const collapsibleRef = useTemplateRef<{
  runAndFocusNew: (action: () => void, ticks?: number) => void;
}>("collapsibleRef");

const { composeAction } = useAsOptionalAddFlow({ path: () => props.path });

function fieldFor(idx: number): FormFieldDef {
  return getItemField(idx, singular);
}

function handleAdd(variantIndex = 0) {
  collapsibleRef.value?.runAndFocusNew(
    composeAction(() => addItem(variantIndex)),
    1,
  );
}

function handleEnableOptional() {
  // Enable + add the first item in one go so the user lands directly on
  // an editable row instead of the empty placeholder.
  collapsibleRef.value?.runAndFocusNew(
    composeAction(() => {
      props.onToggleOptional?.(true);
      addItem(0);
    }),
    2,
  );
}
</script>

<template>
  <AsCollapsible
    ref="collapsibleRef"
    :class="$props.class"
    :title="title"
    :array-index="arrayIndex"
    :description="description"
    :level="level"
    :optional="!!optional"
    :optional-enabled="optionalEnabled"
    :path="path"
    :error="error"
    :hidden="hidden"
    :default-open="defaultOpen"
  >
    <template #title-extras>
      <AsVariantPicker v-if="hasVariantPicker" :union-context="unionCtx!" :disabled="disabled" />
    </template>

    <template #badges>
      <AsItemsChip :count="arrayValue.length" />
    </template>

    <template #actions>
      <!-- Hide Clear only when required+empty: optional arrays keep it
           so the user can collapse back to undefined. -->
      <AsArrayClearBtn
        v-if="isOptional || !isEmpty"
        :label="title"
        :optional="isOptional"
        :disabled="disabled"
        @clear="clear"
      />
    </template>

    <template #body>
      <AsField
        v-for="(_item, idx) in arrayValue"
        :key="itemKeys[idx]"
        :field="fieldFor(idx)"
        :array-index="idx"
        :on-remove="() => removeItem(idx)"
        :can-remove="canRemove"
      />

      <div class="as-array-add-row">
        <button
          v-if="!isUnion"
          type="button"
          class="as-array-add-btn"
          :disabled="!canAdd"
          @click="handleAdd(0)"
        >
          Add {{ singular }}
        </button>
        <div v-else ref="addDropdownRef" class="as-dropdown">
          <button type="button" class="as-array-add-btn" :disabled="!canAdd" @click="toggleAdd">
            Add {{ singular }}
          </button>
          <div v-if="addOpen" class="as-dropdown-menu">
            <button
              v-for="(v, vi) in unionVariants"
              :key="vi"
              type="button"
              class="as-dropdown-item"
              @click="selectAdd(() => handleAdd(vi))"
            >
              {{ v.label }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <template #empty>
      <div class="as-object-empty as-grid-item" :class="$props.class" v-show="!hidden">
        <button type="button" class="as-object-empty-add" @click="handleEnableOptional">
          <span class="i-as-field-fill as-object-empty-add-icon" aria-hidden="true" />
          Add {{ title }}
        </button>
        <p v-if="description" class="as-collapsible-description">{{ description }}</p>
      </div>
    </template>
  </AsCollapsible>
</template>
