<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useMe } from "../api/use-me";
import { filterNavByPermissions } from "../domain/nav-filter";
import { DEMO_TABLES } from "../domain/tables";

const { me } = useMe();
const visible = computed(() => filterNavByPermissions(DEMO_TABLES, me.value?.permissions));
</script>

<template>
  <nav class="flex flex-col gap-1 p-3 w-60 border-1 border-r">
    <RouterLink to="/" class="px-3 py-2 rounded hover:bg-black/5" active-class="bg-black/10"
      >Dashboard</RouterLink
    >
    <div class="mt-3 text-xs uppercase opacity-60 px-3">Tables</div>
    <RouterLink
      v-for="t in visible"
      :key="t.path"
      :to="`/${t.path}`"
      class="px-3 py-2 rounded hover:bg-black/5"
      active-class="bg-black/10"
      >{{ t.label }}</RouterLink
    >
    <div v-if="me" class="mt-auto px-3 py-2 text-sm opacity-70">
      Signed in as <strong>{{ me.username }}</strong> ({{ me.roleName }})
    </div>
  </nav>
</template>
