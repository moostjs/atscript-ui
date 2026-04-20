<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import EditByPath from "../components/EditByPath.vue";

const route = useRoute();
const tablePath = computed(() => String(route.params.table));
const id = computed(() => String(route.params.id));
</script>

<template>
  <EditByPath :table-path="tablePath" :id="id" />
</template>
