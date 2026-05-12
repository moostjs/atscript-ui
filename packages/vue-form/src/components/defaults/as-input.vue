<script setup lang="ts">
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";
import AsInputControl from "../internal/as-input-control.vue";
import AsAdornmentShell from "../internal/as-adornment-shell.vue";

/**
 * Default text/password/textarea input renderer. When AsField sees ANY
 * adornment annotation on the field (`@ui.form.prefix*` /
 * `@ui.form.suffix*` — text or icon), the input renders inside the merged
 * `AsAdornmentShell` chrome family shared with AsNumber / AsDecimal:
 * `[prefix-icon][prefix-text][input][suffix-text][suffix-icon]`. Without
 * any adornment, the plain control renders directly.
 */
const props = defineProps<TAsComponentProps>();

const shellTitle = computed(() => props.currencyCode ?? props.unitCode ?? undefined);
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <AsAdornmentShell
        v-if="hasAdornment"
        :prefix-icon="prefixIcon"
        :prefix="prefix"
        :suffix="suffix"
        :suffix-icon="suffixIcon"
        :error="error"
        :required="required"
        :title="shellTitle"
      >
        <AsInputControl v-bind="$props" :input-id="inputId" />
      </AsAdornmentShell>
      <AsInputControl v-else v-bind="$props" :input-id="inputId" />
    </template>
  </AsFieldShell>
</template>
