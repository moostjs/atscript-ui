<script setup lang="ts">
import type { TAsComponentProps } from "../types";

defineProps<TAsComponentProps>();
</script>

<template>
  <p v-show="!hidden" aria-live="polite">{{ value }}</p>
</template>
