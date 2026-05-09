<script setup lang="ts">
defineProps<{ singular?: string; disabled?: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="as-array-remove-btn"
    :disabled="disabled"
    :aria-label="`Remove ${singular ?? 'item'}`"
    :title="`Remove ${singular ?? 'item'}`"
    @click.stop.prevent="$emit('click')"
  >
    <span class="as-array-remove-btn-icon" aria-hidden="true" />
  </button>
</template>
