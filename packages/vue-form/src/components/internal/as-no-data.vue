<script setup lang="ts">
import { ref } from "vue";

defineProps<{ onEdit: () => void }>();
const hovered = ref(false);
</script>

<template>
  <div
    class="as-no-data"
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
