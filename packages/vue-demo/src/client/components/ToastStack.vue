<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { on403 } from "../api/error-bus";

interface Toast {
  id: string;
  message: string;
}
const toasts = ref<Toast[]>([]);

let off: (() => void) | null = null;
onMounted(() => {
  off = on403.on((t) => {
    toasts.value.push(t);
    setTimeout(() => {
      toasts.value = toasts.value.filter((x) => x.id !== t.id);
    }, 5000);
  });
});
onBeforeUnmount(() => {
  off?.();
});
function dismiss(id: string) {
  toasts.value = toasts.value.filter((x) => x.id !== id);
}
</script>

<template>
  <div class="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="bg-red-600 text-white px-3 py-2 rounded shadow-popup flex items-center gap-3"
    >
      <span>{{ t.message }}</span>
      <button type="button" class="opacity-80 hover:opacity-100" @click="dismiss(t.id)">✕</button>
    </div>
  </div>
</template>
