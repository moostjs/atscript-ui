<script setup lang="ts">
import type { TAsComponentProps } from "../types";

defineProps<TAsComponentProps>();
</script>

<template>
  <p
    v-show="!hidden"
    aria-live="polite"
    class="as-default-field as-paragraph-field"
    :class="$props.class"
    :style="$props.style"
  >
    {{ value }}
  </p>
</template>
