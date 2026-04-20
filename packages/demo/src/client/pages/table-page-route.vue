<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import TablePage from "../components/TablePage.vue";
import { DEMO_TABLES } from "../domain/tables";

const route = useRoute();
const path = computed(() => String(route.params.table));
const label = computed(() => DEMO_TABLES.find((t) => t.path === path.value)?.label ?? path.value);
</script>

<template>
  <TablePage :path="path" :label="label" />
</template>
