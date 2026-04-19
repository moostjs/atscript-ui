<script setup lang="ts">
import type { FormObjectFieldDef } from "@atscript/ui";
import { isObjectField } from "@atscript/ui";
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext, formatIndexedLabel } from "../../composables/use-form-context";
import AsIterator from "../as-iterator.vue";
import AsNoData from "../internal/as-no-data.vue";
import AsStructuredHeader from "../internal/as-structured-header.vue";

const props = defineProps<TAsComponentProps>();

const objectDef = isObjectField(props.field!)
  ? (props.field as FormObjectFieldDef).objectDef
  : undefined;

// ── Union context: consume and clear for nested children ────
const unionCtx = useConsumeUnionContext();

// In array context, show #<index+1> (with or without title)
const displayTitle = computed(() => formatIndexedLabel(props.title, props.arrayIndex));

const optionalEnabled = computed(() => props.model?.value !== undefined);
</script>

<template>
  <div
    class="as-object"
    :class="{ 'as-object--root': level === 0, 'as-object--nested': (level ?? 0) > 0 }"
    v-show="!hidden"
  >
    <AsStructuredHeader
      :title="displayTitle"
      :level="level"
      :on-remove="onRemove && objectDef ? onRemove : undefined"
      :can-remove="canRemove"
      :remove-label="removeLabel"
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
      <div v-if="error" class="as-object-error" role="alert">{{ error }}</div>
      <AsIterator v-if="objectDef" :def="objectDef" />
    </template>
  </div>
</template>
