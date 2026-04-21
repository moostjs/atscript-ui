<script setup lang="ts">
import { computed } from "vue";
import { useDark } from "@vueuse/core";
import { RouterLink, useRouter } from "vue-router";
import { useMe } from "../api/use-me";
import { filterNavByPermissions } from "../domain/nav-filter";
import { DEMO_TABLES } from "../domain/tables";

const router = useRouter();
const { me, logout } = useMe();
const dark = useDark({ storageKey: "as-theme" });
function toggleDark() {
  dark.value = !dark.value;
}
const visible = computed(() => filterNavByPermissions(DEMO_TABLES, me.value?.permissions));

async function onLogout() {
  await logout();
  await router.push("/login");
}
</script>

<template>
  <nav class="flex flex-col gap-[0.2em] p-$s w-[16em] layer-0 border-r-1 shrink-0">
    <RouterLink to="/" class="nav-brand">
      <img src="/logo.svg" alt="" class="w-[1.5em] h-[1.5em]" />
      <span class="font-700 tracking-[-0.01em]">AtShop</span>
      <span class="ml-auto scope-grey font-mono text-callout text-current/50">demo</span>
    </RouterLink>
    <RouterLink to="/" class="nav-link" active-class="nav-link-active">
      <span class="i-ph:house" aria-hidden="true" />
      <span>Dashboard</span>
    </RouterLink>
    <div class="nav-section">Tables</div>
    <RouterLink
      v-for="t in visible"
      :key="t.path"
      :to="`/${t.path}`"
      class="nav-link"
      active-class="nav-link-active"
    >
      <span :class="t.icon" aria-hidden="true" />
      <span>{{ t.label }}</span>
    </RouterLink>
    <div class="mt-auto pt-$s border-t-1 flex flex-col gap-[0.2em]">
      <div v-if="me" class="px-$s py-$xs text-callout text-current/70 truncate">
        Signed in as <strong>{{ me.username }}</strong> ({{ me.roleName }})
      </div>
      <button
        type="button"
        class="c8-flat scope-grey nav-link cursor-pointer border-0 bg-transparent text-left w-full font-inherit"
        :aria-label="dark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleDark"
      >
        <span :class="dark ? 'i-ph:sun' : 'i-ph:moon'" aria-hidden="true" />
        <span>{{ dark ? "Light mode" : "Dark mode" }}</span>
      </button>
      <button
        v-if="me"
        type="button"
        class="c8-flat scope-error nav-link cursor-pointer border-0 bg-transparent text-left w-full font-inherit"
        @click="onLogout"
      >
        <span class="i-ph:sign-out" aria-hidden="true" />
        <span>Log out</span>
      </button>
    </div>
  </nav>
</template>
