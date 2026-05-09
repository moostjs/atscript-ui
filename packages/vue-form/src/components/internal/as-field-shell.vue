<script setup lang="ts">
import { computed, useId } from "vue";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext, formatIndexedLabel } from "../../composables/use-form-context";
import { useFocusFirstAfter } from "../../composables/focus-after-toggle";
import AsNoData from "./as-no-data.vue";
import AsOptionalClear from "./as-optional-clear.vue";
import AsVariantPicker from "./as-variant-picker.vue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = defineProps<
  TAsComponentProps & {
    fieldClass?: string;
    idPrefix?: string;
    /** Suppress all default chrome (label/description/clear/placeholder) — for fields with inline headers (e.g. checkbox). */
    chromeless?: boolean;
    /** Skip the empty-state placeholder; render the input slot directly (e.g. radio group, where unchecked = empty). */
    hideEmptyPlaceholder?: boolean;
  }
>();

const id = useId();
const prefix = props.idPrefix ?? "as-field";
const inputId = `${prefix}-${id}`;
const errorId = `${prefix}-${id}-err`;
const descId = `${prefix}-${id}-desc`;

const optionalEnabled = computed(() => props.model?.value !== undefined);

// ── Union context (optional — present when rendered inside as-union) ──
const unionCtx = useConsumeUnionContext();
const hasVariantPicker = unionCtx !== undefined && unionCtx.variants.length > 1;

// In array context, prepend #<index+1> to the label (same as as-object displayTitle)
const displayLabel = computed(() => formatIndexedLabel(props.label, props.arrayIndex));

const { rootRef, enableOptional } = useFocusFirstAfter(props.onToggleOptional);

const showOptionalClear = computed(
  () => !!props.optional && optionalEnabled.value && !props.chromeless,
);
const showEmptyPlaceholder = computed(
  () =>
    !!props.optional && !optionalEnabled.value && !props.chromeless && !props.hideEmptyPlaceholder,
);
</script>

<template>
  <div ref="rootRef" class="as-default-field" :class="[fieldClass, $props.class]" v-show="!hidden">
    <!-- Header row: label/header on left, action buttons on right -->
    <div
      v-if="
        $slots.header ||
        (displayLabel && !chromeless) ||
        onRemove ||
        showOptionalClear ||
        hasVariantPicker
      "
      class="as-field-header-row"
    >
      <div class="as-field-header-content">
        <template v-if="$slots.header">
          <slot
            name="header"
            :input-id="inputId"
            :desc-id="descId"
            :optional-enabled="optionalEnabled"
          />
        </template>
        <template v-else-if="!chromeless">
          <label v-if="displayLabel" :for="inputId" class="as-field-label">{{ displayLabel }}</label>
        </template>

        <!-- Union variant picker — inline next to label -->
        <AsVariantPicker v-if="hasVariantPicker" :union-context="unionCtx!" :disabled="disabled" />
      </div>

      <div v-if="showOptionalClear || onRemove" class="as-field-header-actions">
        <AsOptionalClear v-if="showOptionalClear" @clear="onToggleOptional?.(false)" />
        <button
          v-if="onRemove"
          type="button"
          class="as-field-remove-btn"
          :disabled="!canRemove"
          :aria-label="removeLabel || 'Remove item'"
          @click="onRemove"
        >
          {{ removeLabel || "Remove" }}
        </button>
      </div>
    </div>

    <div v-if="description && !chromeless" :id="descId" class="as-field-description">
      {{ description }}
    </div>

    <template v-if="showEmptyPlaceholder">
      <AsNoData :kind="type === 'textarea' ? 'textarea' : 'input'" :on-edit="enableOptional" />
    </template>
    <template v-else>
      <div class="as-field-input-row">
        <slot :input-id="inputId" :error-id="errorId" :desc-id="descId" />
      </div>
      <slot name="after-input" :desc-id="descId" />
      <div
        v-if="error || hint"
        :id="errorId"
        class="as-error-slot"
        :role="error ? 'alert' : undefined"
      >
        {{ error || hint }}
      </div>
    </template>
  </div>
</template>
