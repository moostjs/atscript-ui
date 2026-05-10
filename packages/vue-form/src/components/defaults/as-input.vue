<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import AsInputControl from "../internal/as-input-control.vue";

const props = defineProps<TAsComponentProps>();
</script>

<template>
  <AsFieldShell v-bind="$props" id-prefix="as-input">
    <template #default="{ inputId, ariaDescribedBy }">
      <div v-if="icon" class="as-input-with-icon">
        <span :class="['as-input-icon', icon]" aria-hidden="true" />
        <AsInputControl v-bind="props" :input-id="inputId" :aria-described-by="ariaDescribedBy" />
      </div>
      <AsInputControl
        v-else
        v-bind="props"
        :input-id="inputId"
        :aria-described-by="ariaDescribedBy"
      />
    </template>
  </AsFieldShell>
</template>
