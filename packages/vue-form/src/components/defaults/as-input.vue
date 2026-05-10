<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import AsInputControl from "../internal/as-input-control.vue";

defineProps<TAsComponentProps>();
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <div v-if="icon" class="as-input-with-icon">
        <span :class="['as-input-icon', icon]" aria-hidden="true" />
        <AsInputControl v-bind="$props" :input-id="inputId" />
      </div>
      <AsInputControl v-else v-bind="$props" :input-id="inputId" />
    </template>
  </AsFieldShell>
</template>
