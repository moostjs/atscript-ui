<script setup lang="ts">
/** `label` only feeds the aria-label so screen-readers say "Unset City". */
defineProps<{ label?: string; disabled?: boolean }>();
defineEmits<{ clear: [] }>();
</script>

<template>
  <button
    type="button"
    class="as-field-remove-btn"
    :disabled="disabled"
    :aria-label="label ? `Unset ${label}` : 'Unset value'"
    :title="label ? `Unset ${label}` : 'Unset'"
    @click.stop.prevent="$emit('clear')"
  >
    <span class="as-field-remove-btn-icon" aria-hidden="true" />
  </button>
</template>
