<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePreferredDark } from "@vueuse/core";

// Standalone demo pages don't require auth, so the appearance pref can't go
// through the auth-gated `_presets` endpoint that AppShell uses. Local-only
// override is enough for these pages.
const STORAGE_KEY = "atscript-ui:demo:appearance";
type Appearance = "system" | "light" | "dark";

function readStored(): Appearance {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

const appearance = ref<Appearance>(readStored());
const preferredDark = usePreferredDark();

const dark = computed(() => {
  if (appearance.value === "dark") return true;
  if (appearance.value === "light") return false;
  return preferredDark.value;
});

watch(
  dark,
  (isDark) => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
  },
  { immediate: true },
);

function toggle() {
  const next: Appearance = dark.value ? "light" : "dark";
  appearance.value = next;
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, next);
}
</script>

<template>
  <button
    type="button"
    class="inline-grid place-items-center h-fingertip-s w-fingertip-s rounded-base border-1 layer-0 cursor-pointer text-current/70 hover:text-current-hl hover:border-current-hl transition-all duration-120"
    :aria-label="dark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="dark ? 'Light mode' : 'Dark mode'"
    @click="toggle"
  >
    <span :class="dark ? 'i-as-sun' : 'i-as-moon'" class="text-[1.1em]" aria-hidden="true" />
  </button>
</template>
