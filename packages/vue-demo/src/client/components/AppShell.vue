<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";
import { provideCellLocale, useAppPrefs } from "@atscript/vue-table";
import { useMe } from "../api/use-me";
import { on401 } from "../api/error-bus";
import { clientFactory } from "../api/client-factory";
import SidebarNav from "./SidebarNav.vue";
import ToastStack from "./ToastStack.vue";
import WfExpiryBanner from "./WfExpiryBanner.vue";
import ServerErrorDialog from "./ServerErrorDialog.vue";

const router = useRouter();
const { me, loaded, reset } = useMe();
let off401: (() => void) | null = null;

// One subscription at the shell — descendant cells inject this same ref.
const { prefs } = useAppPrefs({ url: "/api/db/_presets", clientFactory });
provideCellLocale(
  computed(() => ({
    language: prefs.value.language,
    timezone: prefs.value.timezone,
  })),
);

onMounted(() => {
  off401 = on401.on(() => {
    reset();
    if (router.currentRoute.value.path !== "/login") void router.push("/login");
  });
});
onBeforeUnmount(() => {
  off401?.();
});

watch(
  [loaded, me],
  ([l, m]) => {
    if (l && !m && router.currentRoute.value.path !== "/login") void router.push("/login");
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-100vh overflow-hidden layer-1">
    <SidebarNav />
    <main class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"><slot /></main>
    <ToastStack />
    <WfExpiryBanner />
    <ServerErrorDialog />
  </div>
</template>
