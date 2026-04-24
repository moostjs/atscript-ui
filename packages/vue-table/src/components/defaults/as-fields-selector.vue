<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import AsOrderableList from "./as-orderable-list.vue";

defineProps<{
  columns: ColumnDef[];
  disabled?: string[];
}>();

const modelValue = defineModel<string[]>({ default: () => [] });

const getLabel = (col: ColumnDef) => col.label;
const getValue = (col: ColumnDef) => col.path;
</script>

<template>
  <AsOrderableList
    :items="columns"
    v-model="modelValue"
    :disabled="disabled"
    :get-label="getLabel"
    :get-value="getValue"
  >
    <template #label="slotProps">
      <slot name="label" v-bind="slotProps">
        <span class="as-orderable-list-item-label">{{ slotProps.label }}</span>
      </slot>
    </template>
    <template #item-extra="slotProps">
      <slot name="item-extra" v-bind="slotProps" />
    </template>
  </AsOrderableList>
</template>
