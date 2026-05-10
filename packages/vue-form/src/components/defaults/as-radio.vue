<script setup lang="ts">
import { optKey, optLabel } from "@atscript/ui";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";

defineProps<TAsComponentProps>();
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="as-radio-field" :hide-empty-placeholder="true">
    <template #header="{ inputId }">
      <span :id="inputId" class="as-field-label">{{ label }}</span>
    </template>
    <template #default="{ inputId }">
      <div
        class="as-radio-group"
        role="radiogroup"
        :aria-labelledby="inputId"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="ariaDescribedBy"
      >
        <label v-for="opt in options" :key="optKey(opt)">
          <input
            type="radio"
            :value="optKey(opt)"
            v-model="model.value"
            @change="onBlur"
            @blur="onBlur"
            :name="name"
            :disabled="disabled"
            :readonly="readonly"
          />
          {{ optLabel(opt) }}
        </label>
      </div>
    </template>
  </AsFieldShell>
</template>
