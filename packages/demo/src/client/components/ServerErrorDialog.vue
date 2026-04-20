<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from "reka-ui";
import { on500 } from "../api/error-bus";

interface Pending {
  status: number;
  message: string;
  retry: () => Promise<Response>;
}
const pending = ref<Pending | null>(null);
const retrying = ref(false);

let off: (() => void) | null = null;
onMounted(() => {
  off = on500.on((e) => {
    pending.value = e;
  });
});
onBeforeUnmount(() => {
  off?.();
});

async function onRetry() {
  if (!pending.value) return;
  retrying.value = true;
  try {
    const res = await pending.value.retry();
    if (res.ok) pending.value = null;
  } finally {
    retrying.value = false;
  }
}
function dismiss() {
  pending.value = null;
}
</script>

<template>
  <DialogRoot
    :open="pending !== null"
    @update:open="
      (o) => {
        if (!o) dismiss();
      }
    "
  >
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/50 z-50" />
      <DialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-900 p-6 rounded shadow-popup min-w-[360px] z-50"
      >
        <DialogTitle class="text-lg font-semibold mb-2">Server error</DialogTitle>
        <p class="opacity-80 mb-4">{{ pending?.message ?? "Something went wrong." }}</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded border-1"
            :disabled="retrying"
            @click="dismiss"
          >
            Dismiss
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-black text-white"
            :disabled="retrying"
            @click="onRetry"
          >
            {{ retrying ? "Retrying…" : "Retry" }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
