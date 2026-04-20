<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import { useMe } from "../api/use-me";
import SidebarNav from "./SidebarNav.vue";

const router = useRouter();
const { me, loaded } = useMe();

watch(
  [loaded, me],
  ([l, m]) => {
    if (l && !m && router.currentRoute.value.path !== "/login") void router.push("/login");
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex h-screen">
    <SidebarNav />
    <main class="flex-1 overflow-auto"><slot /></main>
  </div>
</template>
