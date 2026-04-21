<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { clientForTable } from "../api/client-factory";

const props = defineProps<{ path: string; label: string; icon?: string }>();
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
  <RouterLink
    :to="`/${path}`"
    class="c8-flat scope-primary block p-$m layer-0 border-1 rounded-r2 no-underline text-current transition-colors duration-120"
  >
    <div class="flex items-center gap-$s text-callout text-current/60">
      <span v-if="icon" :class="icon" aria-hidden="true" />
      <span>{{ label }}</span>
    </div>
    <div
      class="text-[1.75em] font-700 tracking-[-0.02em] mt-$xs"
      :class="{ 'text-current/30': count === null }"
    >
      {{ count !== null ? count : err ? "—" : "…" }}
    </div>
  </RouterLink>
</template>
