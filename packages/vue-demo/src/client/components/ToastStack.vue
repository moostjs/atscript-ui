<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { on403, onActionToast } from "../api/error-bus";

interface Entry {
  id: string;
  ok: boolean;
  message: string;
}
const entries = ref<Entry[]>([]);

let off403: (() => void) | null = null;
let offAction: (() => void) | null = null;

function push(entry: Entry, ttl = 5000) {
  entries.value = [...entries.value, entry];
  setTimeout(() => {
    entries.value = entries.value.filter((x) => x.id !== entry.id);
  }, ttl);
}

onMounted(() => {
  off403 = on403.on((t) => push({ id: t.id, ok: false, message: t.message }));
  offAction = onActionToast.on((t) => push({ id: t.id, ok: t.ok, message: t.message }));
});
onBeforeUnmount(() => {
  off403?.();
  offAction?.();
});

function dismiss(id: string) {
  entries.value = entries.value.filter((x) => x.id !== id);
}
</script>

<template>
  <div class="fixed bottom-4 right-4 flex flex-col gap-$xs z-50">
    <div
      v-for="t in entries"
      :key="t.id"
      :class="[
        'layer-0 px-$m py-$s rounded-r2 shadow-popup flex items-center gap-$s border-1',
        t.ok ? 'scope-good' : 'scope-error',
      ]"
    >
      <span
        :class="t.ok ? 'i-as-check' : 'i-as-warning'"
        class="text-current-hl text-[1.25em]"
        aria-hidden="true"
      />
      <span class="text-current">{{ t.message }}</span>
      <button
        type="button"
        class="ml-$s c8-flat fingertip-xs px-$xs rounded-r1"
        aria-label="Dismiss"
        @click="dismiss(t.id)"
      >
        <span class="i-as-close" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
