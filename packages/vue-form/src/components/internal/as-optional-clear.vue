<script setup lang="ts">
import { computed } from "vue";
import { useAsTexts } from "../../composables/use-as-locale";

/** `label` only feeds the aria-label so screen-readers say "Unset City". */
const props = defineProps<{ label?: string; disabled?: boolean }>();
const { t } = useAsTexts();
const unsetField = computed(() => props.label && t("UI_FORM_UNSET_FIELD", { field: props.label }));
defineEmits<{ clear: [] }>();
</script>

<template>
  <button
    type="button"
    class="as-field-remove-btn"
    :disabled="disabled"
    :aria-label="unsetField || t('UI_FORM_UNSET_VALUE')"
    :title="unsetField || t('UI_FORM_UNSET')"
    @click.stop.prevent="$emit('clear')"
  >
    <span class="as-field-remove-btn-icon" aria-hidden="true" />
  </button>
</template>
