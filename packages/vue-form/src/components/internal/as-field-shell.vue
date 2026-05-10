<script setup lang="ts">
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import { useAsUnionVariant, formatIndexedLabelParts } from "../../composables/use-form-context";
import { useAsFocusFirstAfter } from "../../composables/focus-after-toggle";
import AsNoData from "./as-no-data.vue";
import AsOptionalClear from "./as-optional-clear.vue";
import AsVariantPicker from "./as-variant-picker.vue";

// AsFieldShell is internal-only and is always mounted as a child of an
// AsField default — `inputId`, `errorId`, `descId` are populated by
// AsField (see as-field.vue § "Stable a11y ids"). No fallbacks needed.
const props = defineProps<
  TAsComponentProps & {
    fieldClass?: string;
    /** Suppress all default chrome (label/description/clear/placeholder) — for fields with inline headers (e.g. checkbox). */
    chromeless?: boolean;
    /** Skip the empty-state placeholder; render the input slot directly (e.g. radio group, where unchecked = empty). */
    hideEmptyPlaceholder?: boolean;
  }
>();

// Treat both undefined and null as "unset" — DB-roundtripped null (SQL NULL) renders empty placeholder.
const optionalEnabled = computed(() => props.model?.value != null);

// ── Union context (optional — present when rendered inside as-union) ──
const unionCtx = useAsUnionVariant();
const hasVariantPicker = unionCtx !== undefined && unionCtx.variants.length > 1;

const labelParts = computed(() => formatIndexedLabelParts(props.label, props.arrayIndex));

const { rootRef, enableOptional } = useAsFocusFirstAfter(props.onToggleOptional);

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
        (labelParts && !chromeless) ||
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
          <label v-if="labelParts" :for="inputId" class="as-field-label">
            {{ labelParts.base
            }}<span v-if="labelParts.suffix" class="as-field-label-index"
              >&nbsp;{{ labelParts.suffix }}</span
            >
          </label>
        </template>

        <!-- Union variant picker — inline next to label -->
        <AsVariantPicker v-if="hasVariantPicker" :union-context="unionCtx!" :disabled="disabled" />
      </div>

      <div v-if="showOptionalClear || onRemove" class="as-field-header-actions">
        <AsOptionalClear v-if="showOptionalClear" @clear="onToggleOptional?.(false)" />
        <button
          v-else-if="onRemove"
          type="button"
          class="as-field-remove-btn"
          :disabled="!canRemove"
          aria-label="Remove"
          title="Remove"
          @click="onRemove"
        >
          <span class="as-field-remove-btn-icon" aria-hidden="true" />
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
