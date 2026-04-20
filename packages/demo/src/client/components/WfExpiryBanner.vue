<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { on410 } from "../api/error-bus";

const visible = ref(false);
const router = useRouter();
let off: (() => void) | null = null;
onMounted(() => {
  off = on410.on(() => {
    visible.value = true;
  });
});
onBeforeUnmount(() => {
  off?.();
});
function dismiss() {
  visible.value = false;
}
function restart() {
  visible.value = false;
  const cur = router.currentRoute.value.path;
  if (cur.startsWith("/invite/")) void router.push("/login");
  else void router.push(cur);
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed top-0 inset-x-0 bg-yellow-100 border-b border-yellow-300 px-4 py-2 flex items-center gap-3 z-50"
  >
    <span class="flex-1">Your workflow has expired.</span>
    <button type="button" class="underline" @click="restart">Restart</button>
    <button type="button" class="opacity-70 hover:opacity-100" @click="dismiss">Dismiss</button>
  </div>
</template>
