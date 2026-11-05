<script setup lang="ts">
import { computed } from "vue";
import { DEFAULT_BOOLEAN_LABELS, optKey, optLabel } from "@atscript/ui";
import type { TAsComponentProps } from "../types";
import { useAsTriStateCheckbox } from "../../composables/use-as-tri-state-checkbox";
import AsFieldShell from "./as-field-shell.vue";
import AsOptionalClear from "../internal/as-optional-clear.vue";

const props = defineProps<TAsComponentProps<boolean | undefined>>();

const { checked, indeterminate, inputRef, onChange } = useAsTriStateCheckbox({
  modelValue: () => props.model.value,
  onCommit: (v) => {
    props.model.value = v;
  },
});

// Read-only: the value reads as its label (`@ui.literalLabel`, Yes / No by default) —
// a native checkbox ignores `readonly` and would still toggle.
const valueLabel = computed(() => {
  const value = props.model.value;
  if (typeof value !== "boolean") return "";
  const key = value ? "true" : "false";
  const option = props.options?.find((o) => optKey(o) === key);
  return option === undefined ? DEFAULT_BOOLEAN_LABELS[key] : optLabel(option);
});
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="as-checkbox-field" :chromeless="true">
    <template #default="{ inputId }">
      <div class="as-checkbox-row">
        <template v-if="readonly">
          <span :id="`${inputId}-label`" class="as-field-label">{{ label }}</span>
          <span
            :id="inputId"
            class="as-checkbox-value"
            role="group"
            :aria-labelledby="`${inputId}-label`"
            :aria-describedby="ariaDescribedBy"
          >
            {{ valueLabel }}
          </span>
        </template>
        <label
          v-else
          :for="inputId"
          class="as-field-label"
          :class="{ 'as-checkbox-indeterminate': indeterminate }"
        >
          <input
            ref="inputRef"
            :id="inputId"
            type="checkbox"
            :checked="checked"
            @change="onChange"
            @blur="onBlur"
            :name="name"
            :disabled="disabled"
            :aria-invalid="!!error || undefined"
            :aria-describedby="ariaDescribedBy"
          />
          {{ label }}
        </label>
        <!-- Treat both undefined and null as 'unset' — DB-roundtripped null otherwise renders as "set". -->
        <AsOptionalClear
          v-if="optional && !readonly && model.value != null"
          @clear="onToggleOptional?.(false)"
        />
      </div>
    </template>
    <template #after-input="{ descId }">
      <div v-if="description" :id="descId" class="as-field-description">{{ description }}</div>
    </template>
  </AsFieldShell>
</template>
