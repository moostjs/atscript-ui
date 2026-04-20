<script setup lang="ts">
import { computed } from "vue";
import { useMe } from "../api/use-me";
import CountCard from "../components/CountCard.vue";
import { filterNavByPermissions } from "../domain/nav-filter";
import { DEMO_TABLES } from "../domain/tables";

const { me } = useMe();
const visible = computed(() => filterNavByPermissions(DEMO_TABLES, me.value?.permissions));
</script>

<template>
  <div class="p-6 grid gap-4 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
    <CountCard v-for="t in visible" :key="t.path" :path="t.path" :label="t.label" />
  </div>
</template>
