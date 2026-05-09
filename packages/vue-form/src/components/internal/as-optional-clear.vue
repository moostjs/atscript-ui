<script setup lang="ts">
/** `label` is appended to the visible text + aria-label, e.g. "City" → "Clear City". */
defineProps<{ label?: string }>();
defineEmits<{ clear: [] }>();
</script>

<template>
  <button
    type="button"
    class="as-optional-clear"
    :aria-label="label ? `Clear ${label}` : 'Clear value'"
    @click.stop.prevent="$emit('clear')"
  >
    Clear{{ label ? ` ${label}` : "" }}
  </button>
</template>
