<script setup lang="ts" generic="T extends string | number">
import { optKey, optLabel } from "@atscript/ui";
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxViewport,
} from "reka-ui";
import { computed, ref } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";

const props = defineProps<TAsComponentProps<T[] | undefined>>();

// Optional fields with an undefined model use AsFieldShell's AsNoData
// placeholder (same scalar-field behaviour as AsSelect/AsInput). Clicking
// it primes the model via `onToggleOptional`, revealing the combobox.
// The X clear button in the header takes the model back to undefined.

const open = ref(false);

const selectedOptions = computed(() => {
  const v = props.model.value;
  if (!Array.isArray(v) || v.length === 0) return [];
  const set = new Set<string>(v.map((x) => String(x)));
  return (props.options ?? []).filter((o) => set.has(optKey(o)));
});

function deselect(key: string) {
  const current = Array.isArray(props.model.value) ? props.model.value : [];
  props.model.value = current.filter((v) => String(v) !== key) as T[];
}

function clearAll() {
  props.model.value = [] as T[];
}

function selectAll() {
  props.model.value = (props.options ?? []).map((o) => optKey(o)) as T[];
}
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="as-multi-select-field">
    <template #header="{ inputId }">
      <span :id="inputId" class="as-field-label">{{ label }}</span>
    </template>
    <template #default="{ inputId }">
      <ComboboxRoot
        v-model="model.value"
        v-model:open="open"
        :multiple="true"
        :disabled="disabled || readonly"
        :name="name"
        class="as-multi-select-root"
      >
        <ComboboxAnchor class="as-multi-select-anchor" @click="open = true">
          <span v-for="opt in selectedOptions" :key="optKey(opt)" class="as-multi-select-chip">
            <span class="as-multi-select-chip-label">{{ optLabel(opt) }}</span>
            <button
              type="button"
              class="as-multi-select-chip-remove"
              :disabled="disabled || readonly"
              :aria-label="`Remove ${optLabel(opt)}`"
              @click.stop="deselect(optKey(opt))"
            >
              <span class="i-as-close" aria-hidden="true" />
            </button>
          </span>
          <ComboboxInput
            :id="inputId"
            :placeholder="selectedOptions.length ? '' : (placeholder ?? 'Select...')"
            :disabled="disabled"
            :readonly="readonly"
            :aria-required="required || undefined"
            :aria-invalid="!!error || undefined"
            :aria-describedby="ariaDescribedBy"
            :aria-label="!label ? name : undefined"
            class="as-multi-select-input"
            @focus="open = true"
            @blur="onBlur"
          />
          <button
            v-if="selectedOptions.length > 0 && !disabled && !readonly"
            type="button"
            class="as-multi-select-clear"
            aria-label="Clear selection"
            @click.stop.prevent="clearAll"
          >
            <span class="i-as-close" aria-hidden="true" />
          </button>
          <span class="as-multi-select-caret i-as-chevron-down" aria-hidden="true" />
        </ComboboxAnchor>
        <ComboboxPortal>
          <ComboboxContent
            position="popper"
            side="bottom"
            :side-offset="4"
            class="as-multi-select-content"
          >
            <ComboboxViewport class="as-multi-select-viewport">
              <ComboboxItem
                v-for="opt in options"
                :key="optKey(opt)"
                :value="optKey(opt)"
                class="as-multi-select-item"
              >
                <span class="as-multi-select-item-label">{{ optLabel(opt) }}</span>
              </ComboboxItem>
              <ComboboxEmpty class="as-multi-select-empty">No matches</ComboboxEmpty>
            </ComboboxViewport>
            <div v-if="(options?.length ?? 0) > 2" class="as-multi-select-footer">
              <button
                type="button"
                class="as-multi-select-footer-action"
                :disabled="selectedOptions.length === (options?.length ?? 0)"
                @click.stop.prevent="selectAll"
              >
                Select all
              </button>
              <button
                type="button"
                class="as-multi-select-footer-action"
                :disabled="selectedOptions.length === 0"
                @click.stop.prevent="clearAll"
              >
                Clear
              </button>
            </div>
          </ComboboxContent>
        </ComboboxPortal>
      </ComboboxRoot>
    </template>
  </AsFieldShell>
</template>
