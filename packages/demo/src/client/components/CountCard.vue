<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { clientForTable } from "../api/client-factory";

const props = defineProps<{ path: string; label: string }>();
const count = ref<number | null>(null);
const err = ref<string | null>(null);

onMounted(async () => {
  try {
    count.value = await clientForTable(props.path).count();
  } catch (e) {
    err.value = (e as Error).message;
  }
});
</script>

<template>
  <RouterLink :to="`/${path}`" class="block p-4 border-1 rounded hover:bg-black/5">
    <div class="text-sm opacity-70">{{ label }}</div>
    <div v-if="count !== null" class="text-3xl font-semibold mt-1">{{ count }}</div>
    <div v-else-if="err" class="text-3xl opacity-40 mt-1">—</div>
    <div v-else class="text-3xl opacity-40 mt-1">…</div>
  </RouterLink>
</template>
