<script setup lang="ts">
import { computed, ref } from "vue";
import { useAsTexts } from "../../composables/use-as-locale";

const props = withDefaults(
  defineProps<{
    onEdit: () => void;
    /** Visual height variant. `'textarea'` uses a taller min-height to match a multi-line input. */
    kind?: "input" | "textarea";
  }>(),
  { kind: "input" },
);

const { t } = useAsTexts();
const hovered = ref(false);
const rootClass = computed(() =>
  props.kind === "textarea" ? "as-no-data-textarea" : "as-no-data",
);
</script>

<template>
  <div
    :class="rootClass"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @click="onEdit"
    role="button"
    tabindex="0"
    @keydown.enter="onEdit"
    @keydown.space.prevent="onEdit"
  >
    <span class="as-no-data-icon" aria-hidden="true">
      <span :class="hovered ? 'i-as-field-fill' : 'i-as-field-empty'" />
    </span>
    <span class="as-no-data-text">{{
      t(hovered ? "UI_FORM_CLICK_TO_EDIT" : "UI_FORM_NOT_SET")
    }}</span>
  </div>
</template>
