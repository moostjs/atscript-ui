<script setup lang="ts">
import { optKey, optLabel, optionValue } from "@atscript/ui";
import { emptiedKey } from "../../composables/_shape";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";

const props = defineProps<TAsComponentProps>();

// A dropdown bound to a dictionary (since 0.1.190) offers an empty option: choosing it
// empties the field as the picker's "×" does.
const emptyValue = () => emptiedKey(props.field?.prop.type, props.optional);
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
          <option v-if="valueHelp" :value="emptyValue()">{{ placeholder }}</option>
          <option v-else-if="placeholder" value="" disabled>{{ placeholder }}</option>
          <option v-for="opt in options" :key="optKey(opt)" :value="optionValue(opt)">
            {{ optLabel(opt) }}
          </option>
        </select>
        <span class="as-select-caret i-as-chevron-down" aria-hidden="true" />
      </span>
    </template>
  </AsFieldShell>
</template>
