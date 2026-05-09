<script setup lang="ts">
defineProps<{ count: number }>();
</script>

<template>
  <span class="as-array-items-chip" :aria-label="`${count} items`">
    <span class="i-as-menu as-array-items-chip-icon" aria-hidden="true" />
    {{ count }} items
  </span>
</template>
