<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  AsTable,
  AsTableRoot,
  AsWindowTable,
  createDefaultControls,
  createDefaultCellTypes,
  type ActionResult,
  type TVueTableActionInfo,
} from "@atscript/vue-table";
import TableToolbar from "./TableToolbar.vue";
import TablePagination from "./TablePagination.vue";
import { getDemoTable, type ActionsColumn, type TableKind, type TableMode } from "../domain/tables";
import { useMe } from "../api/use-me";
import { onActionToast } from "../api/error-bus";
import { clientForTable } from "../api/client-factory";

const controls = createDefaultControls();
const types = createDefaultCellTypes();
const rowValueFn = (row: Record<string, unknown>) => row.id;

const props = defineProps<{ path: string; label: string }>();
const tableMeta = computed(() => getDemoTable(props.path));
const kind = computed<TableKind>(() => tableMeta.value?.kind ?? "virtual");
const mode = computed<TableMode>(() => tableMeta.value?.mode ?? "pagination");
const limit = computed(() => tableMeta.value?.limit ?? 25);
const actionsColumn = computed<ActionsColumn>(() => tableMeta.value?.actionsColumn ?? "last");

const { me, loaded: meLoaded } = useMe();
const canWrite = computed(() => !!me.value?.permissions?.[props.path]?.write);
// Per-table delete opt-out: customers shows "View orders" as the only row
// action and we don't want Delete to compete (the single-action collapse
// only fires when the row has exactly one action). Other tables fall back
// to write-permission gating.
const canDeleteRows = computed(() => canWrite.value && !tableMeta.value?.noRowDelete);

// Selection-mode toggle. Default to multi when the user can write so bulk
// actions are reachable; the toolbar exposes a flip button so testers can
// verify both `select="multi"` and `select="none"` paths — particularly the
// `merge-select` placement which only renders the actions column in `none`.
// `selectMode` is reactive end-to-end: the renderer re-evaluates the column
// structure live (no remount) and `selectedRows` is auto-cleared on the
// `multi → none` transition. Default `none` so each table opens in its
// passive state — row click/dblclick fires the default action and per-row
// actions render inline; the toolbar's flip button opts into `multi` for
// the checkbox column + bulk-action paths.
const selectMode = ref<"none" | "multi">("none");
const select = computed<"none" | "multi">(() => (canWrite.value ? selectMode.value : "none"));
function toggleSelectMode() {
  selectMode.value = selectMode.value === "multi" ? "none" : "multi";
}
watch(
  () => props.path,
  () => {
    selectMode.value = "none";
  },
);

const filterFields = ref<string[]>([...(tableMeta.value?.defaultFilterFields ?? [])]);
watch(
  () => props.path,
  () => {
    filterFields.value = [...(tableMeta.value?.defaultFilterFields ?? [])];
  },
);

let toastSeq = 0;
function pushToast(ok: boolean, message: string) {
  onActionToast.emit({ id: `t-${++toastSeq}`, ok, message });
}

/**
 * RFC 4180-ish CSV serialiser. Quotes any field containing a comma, quote or
 * newline; doubles embedded quotes. Headers come from the first row's keys.
 */
function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

async function downloadCsv(name: string, ids: unknown[]) {
  const client = clientForTable(name);
  // ids empty (table-level) → first 5000 rows. ids non-empty (rows-level) →
  // filter by PK. Single-PK tables only — composite-PK demo tables aren't on
  // the CSV path today.
  const filter = ids.length > 0 ? { id: { $in: ids } } : {};
  const rows = (await client.query({ filter, limit: 5000 })) as Record<string, unknown>[];
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function onAction(
  action: TVueTableActionInfo,
  ids: unknown[],
  result: ActionResult,
  _event?: KeyboardEvent | MouseEvent,
) {
  // Custom processor: dispatch only — no server hit. Wire the export here.
  if (action.processor === "custom" && action.name === "export-csv") {
    pushToast(true, `Exporting ${props.path} (${ids.length || "all"} rows)…`);
    void downloadCsv(props.path, ids).catch((err) => {
      pushToast(false, `Export failed: ${err instanceof Error ? err.message : String(err)}`);
    });
    return;
  }
  if (!result.ok) {
    pushToast(false, `${action.label || action.name} failed: ${result.error.message}`);
    return;
  }
  if (result.kind === "navigate") {
    // Navigate handled by Client.action(); just confirm in the toast.
    pushToast(true, `Open → ${ids.join(", ")}`);
    return;
  }
  if (result.kind === "remove") {
    const removed = (result.data as { deletedCount?: number })?.deletedCount ?? 1;
    pushToast(true, `Deleted ${removed} row(s).`);
    return;
  }
  if (result.kind === "backend") {
    // Server returns { ok, message } — ok=false is a guard rejection (not an
    // error) so render as a warning-style red toast.
    const data = result.data as { ok?: boolean; message?: string } | undefined;
    const ok = data?.ok !== false;
    pushToast(ok, data?.message ?? result.message ?? `${action.label || action.name} ok`);
  }
}

// Note: row-click / row-dblclick are NOT hand-wired here anymore. The
// table's default row action — declared via `@DbActionDefault` (e.g.
// `users.activate`, `customers.viewOrders` etc.) — is invoked by the
// framework's main-action path on dblclick or Enter (when not in select
// mode). Single-click is reserved for cursor placement / selection
// toggle, never the default action.
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
      :controls="controls"
      :types="types"
      :limit="limit"
      :row-value-fn="rowValueFn"
      :refresh-on-action="true"
      class="flex-1 flex flex-col min-h-0 min-w-0"
      @action="onAction"
    >
      <TableToolbar
        :title="label"
        :table-def="tableDef"
        :select-mode="select"
        :can-toggle-select="canWrite"
        @toggle-select-mode="toggleSelectMode"
      />

      <div
        class="relative flex flex-col flex-1 mx-$l mb-$l min-h-0 min-w-0 border-1 rounded-r2 layer-0 overflow-hidden"
      >
        <AsWindowTable
          v-if="kind === 'window'"
          :select="select"
          :row-delete="canDeleteRows"
          :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }"
        />
        <AsTable
          v-else
          :select="select"
          :row-delete="canDeleteRows"
          :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }"
          :row-actions-column="actionsColumn"
          sticky-header
          :virtual-row-height="36"
          :virtual-overscan="10"
        />
        <div
          v-if="loadingMetadata"
          class="absolute inset-0 grid place-items-center text-current/60"
        >
          Loading…
        </div>
      </div>

      <TablePagination v-if="kind !== 'window' && mode === 'pagination'" />
    </AsTableRoot>
  </div>
</template>
