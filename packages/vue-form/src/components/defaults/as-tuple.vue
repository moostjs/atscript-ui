<script setup lang="ts">
import type { FormTupleFieldDef } from "@atscript/ui";
import { computed, useTemplateRef } from "vue";
import type { TAsComponentProps } from "../types";
import { useAsUnionVariant } from "../../composables/use-form-context";
import { useAsTuple } from "../../composables/use-as-tuple";
import { useAsOptionalAddFlow } from "../../composables/use-as-optional-add-flow";
import AsField from "../as-field.vue";
import AsCollapsible from "../as-collapsible.vue";
import AsArrayClearBtn from "../internal/as-array-clear-btn.vue";
import AsVariantPicker from "../internal/as-variant-picker.vue";

const props = defineProps<TAsComponentProps>();

const tupleField = props.field as FormTupleFieldDef;

// Cleared on consume so nested children don't re-render the picker.
const unionCtx = useAsUnionVariant();
const hasVariantPicker = computed(() => unionCtx !== undefined && unionCtx.variants.length > 1);

const optionalEnabled = computed(() => Array.isArray(props.model?.value));
const disabled = computed(() => props.disabled ?? false);

const { itemFields, positionLabeled, isOptional, clear, fillMissing } = useAsTuple(tupleField);

const level = computed(() => props.level ?? 0);

const defaultOpen = !isOptional;

const collapsibleRef = useTemplateRef<{
  runAndFocusNew: (action: () => void, ticks?: number) => void;
}>("collapsibleRef");

const { composeAction } = useAsOptionalAddFlow({ path: () => props.path });

function handleEnableOptional() {
  // Enable + fill in one go so focus lands on the first editable position.
  collapsibleRef.value?.runAndFocusNew(
    composeAction(() => {
      props.onToggleOptional?.(true);
      fillMissing();
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

    <template v-if="isOptional && optionalEnabled" #actions>
      <AsArrayClearBtn :optional="true" :label="title" :disabled="disabled" @clear="clear" />
    </template>

    <template #body>
      <AsField
        v-for="(itemField, i) in itemFields"
        :key="i"
        :field="itemField"
        :array-index="positionLabeled[i] ? undefined : i"
      />
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
