<script setup lang="ts">
import type { FormArrayFieldDef, FormFieldDef } from "@atscript/ui";
import { resolveSingularLabel } from "@atscript/ui";
import { computed, inject, ref, useTemplateRef } from "vue";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext, formatIndexedLabel } from "../../composables/use-form-context";
import { useFormArray } from "../../composables/use-form-array";
import { useDropdown } from "../../composables/use-dropdown";
import { useNestedSectionsStore } from "../../composables/use-nested-sections";
import { PATH_PREFIX_KEY } from "../../composables/internal-keys";
import AsField from "../as-field.vue";
import AsCollapsible from "../internal/as-collapsible.vue";
import AsItemsChip from "../internal/as-items-chip.vue";
import AsArrayClearBtn from "../internal/as-array-clear-btn.vue";
import AsArrayRemoveBtn from "../internal/as-array-remove-btn.vue";

const props = defineProps<TAsComponentProps>();

const arrayField = props.field as FormArrayFieldDef;

useConsumeUnionContext();

const path = inject(
  PATH_PREFIX_KEY,
  computed(() => ""),
);

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
} = useFormArray(arrayField, disabled);

const level = computed(() => props.level ?? 0);

// Mirrors AsObject's empty-state heading source so the optional placeholder
// reads "Add <label>" with the field's @meta.label, not the singular.
const displayTitle = computed(
  () => formatIndexedLabel(props.title, props.arrayIndex) ?? props.name ?? "",
);

// `@ui.form.label.singular` lives on the array prop; the item prop is a
// fallback so structural item types can override their own singular.
const fromArray = resolveSingularLabel(arrayField.prop);
const singular = fromArray !== "item" ? fromArray : resolveSingularLabel(arrayField.itemField.prop);

const STRUCTURED = new Set(["object", "array", "tuple", "union"]);
const isItemStructured = STRUCTURED.has(arrayField.itemField.type);

// Primitive items pass `singular` as the AsField label fallback so
// formatIndexedLabel produces "phone #2"; island rows render their own
// header and pass an empty name to suppress AsField's inner label.
function fieldFor(idx: number): FormFieldDef {
  return getItemField(idx, isItemStructured ? "" : singular);
}

// Required arrays open by default so the empty body surfaces Add.
const defaultOpen = !isOptional;

const addDropdownRef = ref<HTMLElement | null>(null);
const { isOpen: addOpen, toggle: toggleAdd, select: selectAdd } = useDropdown(addDropdownRef);

const collapsibleRef = useTemplateRef<{
  runAndFocus: (action: () => void, ticks?: number) => void;
}>("collapsibleRef");
const store = useNestedSectionsStore();

function handleAdd(variantIndex = 0) {
  collapsibleRef.value?.runAndFocus(() => {
    if (path.value) store?.setOpen(path.value, true);
    addItem(variantIndex);
  }, 1);
}

function handleEnableOptional() {
  collapsibleRef.value?.runAndFocus(() => {
    props.onToggleOptional?.(true);
    if (path.value) store?.setOpen(path.value, true);
  }, 2);
}
</script>

<template>
  <AsCollapsible
    ref="collapsibleRef"
    :class="$props.class"
    :title="displayTitle"
    :description="description"
    :level="level"
    :optional="!!optional"
    :optional-enabled="optionalEnabled"
    :path="path"
    :error="error"
    :hidden="hidden"
    :default-open="defaultOpen"
  >
    <template #badges>
      <AsItemsChip :count="arrayValue.length" />
    </template>

    <template #actions>
      <AsArrayClearBtn :label="displayTitle" :disabled="disabled || isEmpty" @clear="clear" />
    </template>

    <template #body>
      <div class="as-array-body">
        <template v-for="(_item, idx) in arrayValue" :key="itemKeys[idx]">
          <div v-if="!isItemStructured" class="as-array-row-bare">
            <AsField :field="fieldFor(idx)" :array-index="idx" />
            <AsArrayRemoveBtn :disabled="!canRemove" @click="removeItem(idx)" />
          </div>

          <div v-else class="as-array-row-island">
            <div class="as-array-row-header">
              <span class="as-array-row-label">
                {{ singular }}<span class="as-array-row-label-suffix">#{{ idx + 1 }}</span>
              </span>
              <AsArrayRemoveBtn :disabled="!canRemove" @click="removeItem(idx)" />
            </div>
            <AsField :field="fieldFor(idx)" />
          </div>
        </template>

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
              Add {{ singular }} &#x25BE;
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
      </div>
    </template>

    <template #empty>
      <div class="as-object-empty as-grid-item" :class="$props.class" v-show="!hidden">
        <button type="button" class="as-object-empty-add" @click="handleEnableOptional">
          <span class="i-as-field-fill as-object-empty-add-icon" aria-hidden="true" />
          Add {{ displayTitle }}
        </button>
        <p v-if="description" class="as-collapsible-description">{{ description }}</p>
      </div>
    </template>
  </AsCollapsible>
</template>
