<script setup lang="ts">
import AsOptionalClear from "./as-optional-clear.vue";
import { useAsTexts } from "../../composables/use-as-locale";

// Optional arrays delegate to AsOptionalClear (X icon, "Unset" — value
// → undefined). Required arrays use a text "Clear" button (length → 0)
// since the action keeps the array around.
defineProps<{ label?: string; disabled?: boolean; optional?: boolean }>();
defineEmits<{ clear: [] }>();
const { t } = useAsTexts();
</script>

<template>
  <AsOptionalClear v-if="optional" :label="label" :disabled="disabled" @clear="$emit('clear')" />
  <button
    v-else
    type="button"
    class="as-optional-clear"
    :disabled="disabled"
    :aria-label="label ? t('UI_FORM_CLEAR_FIELD', { field: label }) : t('UI_CLEAR')"
    @click.stop.prevent="$emit('clear')"
  >
    {{ t("UI_CLEAR") }}
  </button>
</template>
