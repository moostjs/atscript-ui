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
    <span class="as-no-data-text">{{ hovered ? "Edit" : "No Data" }}</span>
  </div>
</template>

<style>
.as-no-data {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  background: linear-gradient(
    to top right,
    transparent calc(50% - 0.5px),
    #e5e7eb,
    transparent calc(50% + 0.5px)
  );
}

.as-no-data:hover {
  border-color: #b5c1d9;
  background: linear-gradient(
    to top right,
    transparent calc(50% - 0.5px),
    #c7d2fe,
    transparent calc(50% + 0.5px)
  );
}

.as-no-data-text {
  font-size: 12px;
  color: #9ca3af;
  background: #fff;
  padding: 2px 8px;
  border-radius: 3px;
  user-select: none;
}

.as-no-data:hover .as-no-data-text {
  color: #6366f1;
  font-weight: 500;
}
</style>
