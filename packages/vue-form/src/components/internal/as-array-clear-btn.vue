<script setup lang="ts">
/** `label` is appended to visible text + aria-label, e.g. "Phones" → "Clear Phones". */
defineProps<{ label?: string; disabled?: boolean }>();
defineEmits<{ clear: [] }>();
</script>

<template>
  <button
    type="button"
    class="as-array-clear-btn"
    :disabled="disabled"
    :aria-label="label ? `Clear ${label}` : 'Clear'"
    @click.stop.prevent="$emit('clear')"
  >
    Clear{{ label ? ` ${label}` : "" }}
  </button>
</template>
