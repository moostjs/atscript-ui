<script setup lang="ts">
import { optKey, optLabel } from "@atscript/ui";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";

defineProps<TAsComponentProps>();
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <span class="as-select-wrap">
        <select
          :id="inputId"
          v-model="model.value"
          @change="onBlur"
          @blur="onBlur"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
        >
          <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
          <option v-for="opt in options" :key="optKey(opt)" :value="optKey(opt)">
            {{ optLabel(opt) }}
          </option>
        </select>
        <span class="as-select-caret i-as-chevron-down" aria-hidden="true" />
      </span>
    </template>
  </AsFieldShell>
</template>
