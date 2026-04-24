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
  <div class="flex-1 overflow-y-auto">
    <div class="p-$l">
      <div class="as-page-eyebrow">atscript-ui demo</div>
      <h1 class="as-page-title mb-$m">Dashboard</h1>
      <div class="grid gap-$m grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
        <CountCard
          v-for="t in visible"
          :key="t.path"
          :path="t.path"
          :label="t.label"
          :icon="t.icon"
        />
      </div>
    </div>
  </div>
</template>
