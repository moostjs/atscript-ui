<script setup lang="ts">
// `label` only feeds the aria-label so screen-readers say "Clear Tags";
// visible text is always just "Clear" to mirror AsObject's chrome parity.
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
    Clear
  </button>
</template>
