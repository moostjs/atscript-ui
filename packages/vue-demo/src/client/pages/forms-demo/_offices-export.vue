<script setup lang="ts">
import { ref } from "vue";
import { useTableExport } from "@atscript/vue-table";

// The table's own CSV export: a column with `@ui.valueLabel` exports its code with the text.
const { exportRows } = useTableExport();
const csv = ref("");
async function run() {
  const result = await exportRows({ format: "csv" });
  if (result.format === "csv") csv.value = result.csv;
}
</script>

<template>
  <div class="flex flex-col gap-$s">
    <button type="button" class="scope-primary c8-filled btn self-start" @click="run">
      Export CSV
    </button>
    <pre v-if="csv" data-testid="offices-export" class="text-callout overflow-auto">{{ csv }}</pre>
  </div>
</template>
