<script setup lang="ts">
import { computed } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import AsInputControl from "../internal/as-input-control.vue";

/**
 * Default text/number/password input renderer. When `prefix` or `suffix`
 * is resolved at AsField (from `@ui.form.prefix*` / `@ui.form.suffix*`),
 * the bordered shell wraps the raw control with adornment pills. With
 * neither set, the chrome is visually unchanged from the plain
 * `AsInputControl` rendering.
 *
 * `icon` and prefix/suffix can coexist — the icon overlay sits inside
 * the same shell as before (left-padded onto the input itself); the
 * prefix/suffix pills paint outside that.
 */
const props = defineProps<TAsComponentProps>();

const hasAdornment = computed(() => !!props.prefix || !!props.suffix);
const shellTitle = computed(() => props.currencyCode ?? props.unitCode ?? undefined);
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <!-- With prefix/suffix: merged-chrome shell with adornment pills. -->
      <div
        v-if="hasAdornment"
        class="as-input-shell"
        :class="{ error: !!error, required }"
        :title="shellTitle"
      >
        <span v-if="prefix" class="as-prefix" aria-hidden="true">{{ prefix }}</span>
        <template v-if="icon">
          <div class="as-input-with-icon as-input-shell-icon-wrap">
            <span :class="['as-input-icon', icon]" aria-hidden="true" />
            <AsInputControl v-bind="$props" :input-id="inputId" />
          </div>
        </template>
        <AsInputControl v-else v-bind="$props" :input-id="inputId" />
        <span v-if="suffix" class="as-suffix" aria-hidden="true">{{ suffix }}</span>
      </div>
      <!-- No prefix/suffix — keep the legacy icon-or-plain rendering. -->
      <template v-else>
        <div v-if="icon" class="as-input-with-icon">
          <span :class="['as-input-icon', icon]" aria-hidden="true" />
          <AsInputControl v-bind="$props" :input-id="inputId" />
        </div>
        <AsInputControl v-else v-bind="$props" :input-id="inputId" />
      </template>
    </template>
  </AsFieldShell>
</template>
