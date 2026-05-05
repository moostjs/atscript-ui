<script setup lang="ts">
import { computed } from "vue";

// `String(value)` fallback covers circular references — `JSON.stringify` would
// otherwise throw inside the cell render.
const props = defineProps<{ value: unknown }>();

const pretty = computed(() => {
  const v = props.value;
  if (v === null || v === undefined) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
});
</script>

<template>
  <pre class="as-cell-json-pre"><code>{{ pretty }}</code></pre>
</template>
