<script setup lang="ts">
import AsOptionalClear from "./as-optional-clear.vue";

// Optional arrays delegate to AsOptionalClear (X icon, "Unset" — value
// → undefined). Required arrays use a text "Clear" button (length → 0)
// since the action keeps the array around.
defineProps<{ label?: string; disabled?: boolean; optional?: boolean }>();
defineEmits<{ clear: [] }>();
</script>

<template>
  <AsOptionalClear v-if="optional" :label="label" :disabled="disabled" @clear="$emit('clear')" />
  <button
    v-else
    type="button"
    class="as-optional-clear"
    :disabled="disabled"
    :aria-label="label ? `Clear ${label}` : 'Clear'"
    @click.stop.prevent="$emit('clear')"
  >
    Clear
  </button>
</template>
