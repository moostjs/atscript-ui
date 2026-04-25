<script setup lang="ts">
import { computed, useId } from "vue";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext, formatIndexedLabel } from "../../composables/use-form-context";
import AsNoData from "./as-no-data.vue";
import AsVariantPicker from "./as-variant-picker.vue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = defineProps<
  TAsComponentProps & {
    fieldClass?: string;
    idPrefix?: string;
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
</script>

<template>
  <div class="as-default-field" :class="[fieldClass, $props.class]" v-show="!hidden">
    <!-- Header row: label/header on left, action buttons on right -->
    <div
      v-if="
        displayLabel ||
        onRemove ||
        (optional && optionalEnabled) ||
        hasVariantPicker ||
        $slots.header
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
        <template v-else>
          <label v-if="displayLabel" :for="inputId">{{ displayLabel }}</label>
        </template>

        <!-- Union variant picker — inline next to label -->
        <AsVariantPicker v-if="hasVariantPicker" :union-context="unionCtx!" :disabled="disabled" />
      </div>

      <div v-if="(optional && optionalEnabled) || onRemove" class="as-field-header-actions">
        <button
          v-if="optional && optionalEnabled"
          type="button"
          class="as-optional-clear"
          @click="onToggleOptional?.(false)"
        >
          &times;
        </button>
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

    <div v-if="description && !$slots.header" :id="descId" class="as-field-description">
      {{ description }}
    </div>

    <template v-if="optional && !optionalEnabled">
      <AsNoData :on-edit="() => onToggleOptional?.(true)" />
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
