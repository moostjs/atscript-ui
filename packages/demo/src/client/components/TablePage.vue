<script setup lang="ts">
import { AsTable, AsTableRoot, createDefaultTableComponents } from "@atscript/vue-table";
import { useRouter } from "vue-router";

const props = defineProps<{ path: string; label: string }>();
const router = useRouter();
const components = createDefaultTableComponents();

function onRowClick(row: Record<string, unknown>) {
  if (row.id == null) return;
  void router.push(`/${props.path}/${row.id}/edit`);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <header class="flex items-center justify-between p-4 border-1 border-b">
      <h1 class="text-lg font-semibold">{{ label }}</h1>
      <div class="demo-table-toolbar flex gap-2" />
    </header>

    <AsTableRoot
      v-slot="{ loadingMetadata }"
      :url="`/api/db/tables/${path}`"
      :components="components"
      :limit="25"
      class="flex-1"
    >
      <div class="demo-table-selection-bar" />
      <AsTable
        :column-menu="{ sort: true, filters: true, hide: true }"
        @row-click="onRowClick"
      />
      <div v-if="loadingMetadata" class="p-4 opacity-70">Loading…</div>
    </AsTableRoot>
  </div>
</template>
