<script setup lang="ts">
import {
  UI_FORM_FN_OPTIONS,
  UI_FORM_OPTIONS,
  extractFieldLiteralOptions,
  hasFieldMeta,
  optKey,
  optLabel,
  optionValue,
} from "@atscript/ui";
import { emptiedKey } from "../../composables/_shape";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";

const props = defineProps<TAsComponentProps>();

// A dropdown listing a dictionary's values (since 0.1.190) offers an empty option: choosing
// it empties the field as the picker's "×" does. A bound field with options of its own (a
// literal union, `@ui.form.options`) lists those, with the placeholder as before.
const prop = props.field?.prop;
const listsDictionary =
  !!props.valueHelp &&
  !!prop &&
  !hasFieldMeta(prop, UI_FORM_OPTIONS) &&
  !hasFieldMeta(prop, UI_FORM_FN_OPTIONS) &&
  extractFieldLiteralOptions(prop) === undefined;
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
          <option v-if="listsDictionary" :value="emptyValue()">{{ placeholder }}</option>
          <option v-else-if="placeholder" value="" disabled>{{ placeholder }}</option>
          <option
            v-for="(opt, i) in options"
            :key="`${i}:${optKey(opt)}`"
            :value="optionValue(opt)"
          >
            {{ optLabel(opt) }}
          </option>
        </select>
        <span class="as-select-caret i-as-chevron-down" aria-hidden="true" />
      </span>
    </template>
  </AsFieldShell>
</template>
