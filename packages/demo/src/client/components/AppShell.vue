<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";
import { useMe } from "../api/use-me";
import { on401 } from "../api/error-bus";
import SidebarNav from "./SidebarNav.vue";
import ToastStack from "./ToastStack.vue";
import WfExpiryBanner from "./WfExpiryBanner.vue";
import ServerErrorDialog from "./ServerErrorDialog.vue";

const router = useRouter();
const { me, loaded, reset } = useMe();
let off401: (() => void) | null = null;

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
  <div class="flex h-screen">
    <SidebarNav />
    <main class="flex-1 overflow-auto"><slot /></main>
    <ToastStack />
    <WfExpiryBanner />
    <ServerErrorDialog />
  </div>
</template>
