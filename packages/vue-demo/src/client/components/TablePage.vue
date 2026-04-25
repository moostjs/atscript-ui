<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { AsTable, AsTableRoot, createDefaultTableComponents } from "@atscript/vue-table";
import { useRouter } from "vue-router";
import InviteButton from "./InviteButton.vue";
import TableToolbar from "./TableToolbar.vue";
import TablePagination from "./TablePagination.vue";
import InfiniteScroll from "./InfiniteScroll.vue";
import { sharedFetch } from "../api/fetch";
import { getDemoTable, type TableMode } from "../domain/tables";
import { useMe } from "../api/use-me";
import { clientForTable } from "../api/client-factory";

const components = createDefaultTableComponents();
const rowValueFn = (row: Record<string, unknown>) => row.id;

const props = defineProps<{ path: string; label: string }>();
const router = useRouter();
const tableMeta = computed(() => getDemoTable(props.path));
const mode = computed<TableMode>(() => tableMeta.value?.mode ?? "pagination");
const limit = computed(() => tableMeta.value?.limit ?? 25);

const { me, loaded: meLoaded } = useMe();
const canWrite = computed(() => !!me.value?.permissions?.[props.path]?.write);
const select = computed<"none" | "multi">(() => (canWrite.value ? "multi" : "none"));

const filterFields = ref<string[]>([...(tableMeta.value?.defaultFilterFields ?? [])]);
watch(
  () => props.path,
  () => {
    filterFields.value = [...(tableMeta.value?.defaultFilterFields ?? [])];
  },
);

function isInSelectCell(event: MouseEvent) {
  return !!(event.target as HTMLElement | null)?.closest(".as-td-select");
}

function navigate(row: Record<string, unknown>) {
  if (row.id == null) return;
  void router.push(`/${props.path}/${row.id}/edit`);
}

// In multi-select mode single clicks are claimed by the ListboxItem for selection;
// navigation happens on double-click instead.
function onRowClick(row: Record<string, unknown>, event: MouseEvent) {
  if (select.value === "multi") return;
  if (isInSelectCell(event)) return;
  navigate(row);
}

function onRowDblClick(row: Record<string, unknown>, event: MouseEvent) {
  if (isInSelectCell(event)) return;
  navigate(row);
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

async function onDeleteSelected(ids: unknown[]) {
  if (ids.length === 0) return;
  const label = ids.length === 1 ? "record" : `${ids.length} records`;
  if (!window.confirm(`Delete ${label} from ${props.path}? This cannot be undone.`)) return;
  const client = clientForTable(props.path);
  await Promise.all(ids.map((id) => client.remove(id as never)));
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0 min-w-0">
    <div v-if="!meLoaded" class="flex-1 grid place-items-center text-current/60" aria-busy="true">
      Loading…
    </div>
    <AsTableRoot
      v-else
      :key="path"
      v-slot="{ loadingMetadata, tableDef }"
      v-model:filter-fields="filterFields"
      :url="`/api/db/tables/${path}`"
      :components="components"
      :limit="limit"
      :select="select"
      :row-value-fn="rowValueFn"
      class="flex-1 flex flex-col min-h-0 min-w-0"
    >
      <TableToolbar
        :title="label"
        :table-def="tableDef"
        :on-delete-selected="canWrite ? onDeleteSelected : undefined"
      >
        <template #actions>
          <InviteButton v-if="path === 'users'" />
          <button
            v-if="path === 'orders'"
            type="button"
            class="c8-flat scope-error as-page-toolbar-btn"
            @click="bulkCancelFirstFive"
          >
            <span class="i-ph:x-circle" aria-hidden="true" />
            <span>Bulk cancel first five</span>
          </button>
        </template>
      </TableToolbar>

      <div
        class="relative flex flex-col flex-1 mx-$l mb-$l min-h-0 min-w-0 border-1 rounded-r2 layer-0 overflow-hidden"
      >
        <AsTable
          :column-menu="{ sort: true, filters: true, hide: true }"
          sticky-header
          :virtual-row-height="36"
          :virtual-overscan="10"
          @row-click="onRowClick"
          @row-dblclick="onRowDblClick"
        />
        <div
          v-if="loadingMetadata"
          class="absolute inset-0 grid place-items-center text-current/60"
        >
          Loading…
        </div>
        <InfiniteScroll v-if="mode === 'infinite'" />
      </div>

      <TablePagination v-if="mode === 'pagination'" />
    </AsTableRoot>
  </div>
</template>
