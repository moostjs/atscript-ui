<script setup lang="ts">
import { AsTable, AsTableRoot, createDefaultTableComponents } from "@atscript/vue-table";
import { useRouter } from "vue-router";
import InviteButton from "./InviteButton.vue";
import { sharedFetch } from "../api/fetch";

const props = defineProps<{ path: string; label: string }>();
const router = useRouter();
const components = createDefaultTableComponents();

function onRowClick(row: Record<string, unknown>) {
  if (row.id == null) return;
  void router.push(`/${props.path}/${row.id}/edit`);
}

async function bulkCancelFirstFive() {
  // seed.ts cycles statuses[i % 5] → id 4 is 'delivered'. Cancelling [1..5]
  // intentionally triggers the 500 path so the error dialog surfaces.
  await sharedFetch("/api/actions/orders/bulk-cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: [1, 2, 3, 4, 5] }),
  });
}
</script>

<template>
  <div class="flex flex-col h-full">
    <header class="flex items-center justify-between p-4 border-1 border-b">
      <h1 class="text-lg font-semibold">{{ label }}</h1>
      <div class="demo-table-toolbar flex gap-2">
        <InviteButton v-if="path === 'users'" />
      </div>
    </header>

    <AsTableRoot
      v-slot="{ loadingMetadata }"
      :url="`/api/db/tables/${path}`"
      :components="components"
      :limit="25"
      class="flex-1"
    >
      <div class="demo-table-selection-bar">
        <button
          v-if="path === 'orders'"
          type="button"
          class="px-3 py-1.5 rounded bg-red-600 text-white text-sm"
          @click="bulkCancelFirstFive"
        >
          Bulk cancel first five orders
        </button>
      </div>
      <AsTable :column-menu="{ sort: true, filters: true, hide: true }" @row-click="onRowClick" />
      <div v-if="loadingMetadata" class="p-4 opacity-70">Loading…</div>
    </AsTableRoot>
  </div>
</template>
