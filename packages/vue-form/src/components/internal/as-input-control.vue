<script setup lang="ts">
import type { TAsComponentProps } from "../types";

// `inputId` is supplied per-mount by AsFieldShell's slot so the chrome and
// the input share the same id. `ariaDescribedBy` overrides the prop coming
// from `TAsComponentProps` so the slot's locally-computed fallback wins
// when AsField did not pre-resolve it.
defineProps<
  TAsComponentProps & {
    inputId: string;
  }
>();
</script>

<template>
  <textarea
    v-if="type === 'textarea'"
    :id="inputId"
    v-model="model.value"
    @blur="onBlur"
    :placeholder="placeholder"
    :name="name"
    :disabled="disabled"
    :readonly="readonly"
    :maxlength="maxLength"
    :aria-required="required || undefined"
    :aria-invalid="!!error || undefined"
    :aria-describedby="ariaDescribedBy"
    :aria-label="!label ? name : undefined"
  />
  <input
    v-else
    :id="inputId"
    v-model="model.value"
    @blur="onBlur"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :name="name"
    :type="type"
    :disabled="disabled"
    :readonly="readonly"
    :aria-required="required || undefined"
    :aria-invalid="!!error || undefined"
    :aria-describedby="ariaDescribedBy"
    :aria-label="!label ? name : undefined"
  />
</template>
