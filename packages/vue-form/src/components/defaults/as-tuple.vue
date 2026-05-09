<script setup lang="ts">
import type { FormTupleFieldDef } from "@atscript/ui";
import { isTupleField } from "@atscript/ui";
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext } from "../../composables/use-form-context";
import { useFocusFirstAfter } from "../../composables/focus-after-toggle";
import AsField from "../as-field.vue";
import AsNoData from "../internal/as-no-data.vue";
import AsStructuredHeader from "../internal/as-structured-header.vue";

const props = defineProps<TAsComponentProps>();

const tupleField = isTupleField(props.field!) ? (props.field as FormTupleFieldDef) : undefined;

// ── Union context: consume and clear for nested children ────
const unionCtx = useConsumeUnionContext();

const optionalEnabled = computed(() => props.model?.value !== undefined);

const { rootRef, enableOptional } = useFocusFirstAfter(props.onToggleOptional);
</script>

<template>
  <div ref="rootRef" class="as-tuple" v-show="!hidden">
    <AsStructuredHeader
      :title="title"
      :level="level"
      :on-remove="onRemove"
      :can-remove="canRemove"
      :remove-label="removeLabel"
      :optional="optional"
      :optional-enabled="optionalEnabled"
      :on-toggle-optional="onToggleOptional"
      :disabled="disabled"
      :union-context="unionCtx"
    />

    <template v-if="optional && !optionalEnabled">
      <AsNoData :on-edit="enableOptional" />
    </template>
    <template v-else>
      <template v-if="tupleField">
        <AsField v-for="(itemField, i) in tupleField.itemFields" :key="i" :field="itemField" />
      </template>

      <div v-if="error" class="as-tuple-error" role="alert">{{ error }}</div>
    </template>
  </div>
</template>

<style>
.as-tuple {
  margin: 12px 0;
}

.as-tuple-error {
  font-size: 12px;
  color: #ef4444;
}
</style>
