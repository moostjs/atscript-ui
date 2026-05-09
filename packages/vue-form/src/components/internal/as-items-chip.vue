<script setup lang="ts">
defineProps<{ count: number }>();
</script>

<template>
  <span class="as-array-items-chip">{{ count }} items</span>
</template>
