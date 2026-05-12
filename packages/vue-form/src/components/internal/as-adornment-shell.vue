<script setup lang="ts">
/**
 * Internal merged-chrome wrapper for adorned inputs. Renders the bordered
 * `.as-input-shell` container with prefix/suffix icon + text pills around
 * the slotted input control. Used by AsInput / AsDate / AsDatetime /
 * AsTime when AsField sees ANY adornment-driving annotation on the field.
 *
 * AsNumber / AsDecimal keep their own bespoke shells (`as-number` /
 * `as-decimal`) because they need extra internals (split integer/decimal
 * inputs, sign behaviour). The icon span classes (`as-prefix-icon`,
 * `as-suffix-icon`) are shared across the input family.
 *
 * Tier 3 — not exported from the package barrel.
 */
defineProps<{
  prefixIcon?: string;
  prefix?: string;
  suffix?: string;
  suffixIcon?: string;
  error?: boolean | string | null;
  required?: boolean;
  title?: string;
}>();
</script>

<template>
  <div class="as-input-shell" :class="{ error: !!error, required }" :title="title">
    <span v-if="prefixIcon" class="as-prefix-icon" :class="prefixIcon" aria-hidden="true" />
    <span v-if="prefix" class="as-prefix" aria-hidden="true">{{ prefix }}</span>
    <slot />
    <span v-if="suffix" class="as-suffix" aria-hidden="true">{{ suffix }}</span>
    <span v-if="suffixIcon" class="as-suffix-icon" :class="suffixIcon" aria-hidden="true" />
  </div>
</template>
