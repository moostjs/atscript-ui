<script setup lang="ts">
import type { FormTupleFieldDef } from "@atscript/ui";
import { computed, inject, useTemplateRef } from "vue";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext, formatIndexedLabel } from "../../composables/use-form-context";
import { useFormTuple } from "../../composables/use-form-tuple";
import { useNestedSectionsStore } from "../../composables/use-nested-sections";
import { PATH_PREFIX_KEY } from "../../composables/internal-keys";
import AsField from "../as-field.vue";
import AsCollapsible from "../internal/as-collapsible.vue";
import AsArrayClearBtn from "../internal/as-array-clear-btn.vue";

const props = defineProps<TAsComponentProps>();

const tupleField = props.field as FormTupleFieldDef;

useConsumeUnionContext();

const path = inject(
  PATH_PREFIX_KEY,
  computed(() => ""),
);

const optionalEnabled = computed(() => Array.isArray(props.model?.value));
const disabled = computed(() => props.disabled ?? false);

const { itemFields, isOptional, clear, fillMissing } = useFormTuple(tupleField);

const level = computed(() => props.level ?? 0);

const displayTitle = computed(
  () => formatIndexedLabel(props.title, props.arrayIndex) ?? props.name ?? "",
);

const defaultOpen = !isOptional;

const collapsibleRef = useTemplateRef<{
  runAndFocusNew: (action: () => void, ticks?: number) => void;
}>("collapsibleRef");
const store = useNestedSectionsStore();

function handleEnableOptional() {
  // Enable + fill in one go so focus lands on the first editable position.
  collapsibleRef.value?.runAndFocusNew(() => {
    props.onToggleOptional?.(true);
    if (path.value) store?.setOpen(path.value, true);
    fillMissing();
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
    <template v-if="isOptional && optionalEnabled" #actions>
      <AsArrayClearBtn
        :optional="true"
        :label="displayTitle"
        :disabled="disabled"
        @clear="clear"
      />
    </template>

    <template #body>
      <AsField v-for="(itemField, i) in itemFields" :key="i" :field="itemField" />
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
