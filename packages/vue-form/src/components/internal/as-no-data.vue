<script setup lang="ts">
import { computed, ref } from "vue";

const props = withDefaults(
  defineProps<{
    onEdit: () => void;
    /** Visual height variant. `'textarea'` uses a taller min-height to match a multi-line input. */
    kind?: "input" | "textarea";
  }>(),
  { kind: "input" },
);

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
    <span class="as-no-data-plus" aria-hidden="true">
      <span class="i-as-plus" />
    </span>
    <span class="as-no-data-text">{{ hovered ? "Edit" : "No Data" }}</span>
  </div>
</template>
