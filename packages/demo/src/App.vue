<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppShell from "./client/components/AppShell.vue";

const route = useRoute();
const isAnonymous = computed(
  () =>
    route.path === "/login" ||
    route.path === "/register" ||
    route.path.startsWith("/invite/"),
);
</script>

<template>
  <AppShell v-if="!isAnonymous"><RouterView /></AppShell>
  <RouterView v-else />
</template>
