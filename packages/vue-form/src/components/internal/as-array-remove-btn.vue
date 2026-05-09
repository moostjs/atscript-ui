<script setup lang="ts">
defineProps<{ disabled?: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="as-array-remove-btn"
    :disabled="disabled"
    aria-label="Remove"
    title="Remove"
    @click.stop.prevent="$emit('click')"
  >
    <span class="as-array-remove-btn-icon" aria-hidden="true" />
  </button>
</template>
