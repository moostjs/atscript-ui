<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, type Component, type Ref } from "vue";
import type { SortControl, ClientFactory } from "@atscript/ui";
import type { TAsTypeComponents } from "@atscript/vue-form";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type { ColumnWidthsMap, UrlQuerySync } from "@atscript/ui-table";
import type {
  ActionResult,
  PresetConfig,
  TAsCellTypeComponents,
  TAsTableControls,
  TVueTableActionInfo,
} from "../types";
import { useTable } from "../composables/use-table";
import { useRegisterMainActionListener } from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
import { useTableNavBridge } from "../composables/use-table-nav-bridge";
import type { SelectionPersistence } from "../composables/use-table-selection";
import type { PageResult } from "@atscript/db-client";
// `AsConfirmDialog` stays a static import — it's tiny and core to the
// prompt/confirm path. The config / filter / preset dialogs each pull in a
// heavier subtree, so they're lazy-loaded and only mounted once their open
// state first flips true (see the `everOpened*` latches below). Consumers who
// want eager loading or a custom dialog assign `controls.X` to override.
import { AsConfirmDialog } from "./defaults";

const AsConfigDialog = defineAsyncComponent(() => import("./defaults/as-config-dialog.vue"));
const AsFilterDialog = defineAsyncComponent(() => import("./defaults/as-filter-dialog.vue"));
const AsPresetDialog = defineAsyncComponent(() => import("./defaults/as-preset-dialog.vue"));

// `AsActionFormDialog` pulls in the whole `@atscript/vue-form` runtime, so
// it's lazy-loaded and only mounted when `hasInputFormActions` flips true
// (see below). Consumers who want eager loading or a custom dialog assign
// `controls.actionFormDialog` to override this fallback. Don't inline-import
// here — it silently re-bundles vue-form into every table consumer.
const LazyActionFormDialog = defineAsyncComponent(
  () => import("./defaults/as-action-form-dialog.vue"),
);

const props = withDefaults(
  defineProps<{
    /** Table endpoint URL (e.g. "/db/tables/products"). */
    url: string;
    /** Factory to create a client from a URL. Falls back to the app-wide default set via `setDefaultClientFactory` (or the built-in `new Client(url)` factory if unset). */
    clientFactory?: ClientFactory;
    /** Skin-slot overrides for table chrome — header cells, filter dialog, column menu, etc. Use {@link createDefaultControls} to seed defaults. */
    controls?: TAsTableControls;
    /** Cell-type → component dispatch map. Use {@link createDefaultCellTypes} to seed defaults. */
    types?: TAsCellTypeComponents;
    /** Named cell-component overrides — looked up by `@ui.table.component "name"`. */
    components?: Record<string, Component>;
    /**
     * Form-type → component dispatch map for the built-in action-form dialog.
     * Defaults to `createDefaultTypes()` from `@atscript/vue-form`.
     */
    formTypes?: TAsTypeComponents;
    /** Named form-component overrides for the action-form dialog. */
    formComponents?: Record<string, Component>;
    limit?: number;
    forceFilters?: FilterExpr;
    forceSorters?: SortControl[];
    /**
     * Leaf field paths always added to `$select` (deduped, gated by available
     * meta), regardless of which columns are visible. Additive only.
     */
    alwaysSelected?: string[];
    queryOnMount?: boolean;
    queryFn?: (
      query: Uniquery,
      page: number,
      size: number,
    ) => Promise<PageResult<Record<string, unknown>>>;
    blockQuery?: boolean;
    rowValueFn?: (row: Record<string, unknown>) => unknown;
    /**
     * Selection write policy applied on every results-replacement.
     * - `"clear"` — drop everything.
     * - `"trim"` (default) — keep PKs that survive the new result set.
     * - `"persist"` — never write to `selectedRows`; full consumer ownership.
     */
    selectionPersistence?: SelectionPersistence;
    /** Page-alignment unit for `loadRange` and `queryNext` extension. */
    blockSize?: number;
    /** Debounce window for the topIndex/viewportRowCount watcher. */
    dragReleaseDebounceMs?: number;
    /**
     * Refetch policy: when `true` (default), successful `'backend'` /
     * `'__remove'` invocations call `state.query()` after settling. Per-call
     * `state.actions.invoke(action, pk, { suppressRefresh: true })` overrides.
     */
    refreshOnAction?: boolean;
    /**
     * Per-aspect opt-in/out for `v-model:url-query`. Default (omitted): full
     * sync — filters, sorters, `searchTerm`, and pagination all round-trip.
     * Set fields to `false`/`true`/`string[]` to gate. Has no effect unless
     * `v-model:url-query` is bound.
     *
     * @example
     * `:url-query-sync="{ pagination: false }"` — shareable filtered view,
     *   recipients aren't pinned to your current page.
     * `:url-query-sync="{ filters: ['status'], sorters: false }"` — only
     *   `status` filter participates; sorters stay private.
     */
    urlQuerySync?: UrlQuerySync;

    /** See {@link PresetConfig}. Omit to disable presets. */
    preset?: PresetConfig;
  }>(),
  {
    queryOnMount: true,
    selectionPersistence: "trim",
    refreshOnAction: true,
  },
);

const emit = defineEmits<{
  (
    e: "main-action",
    row: Record<string, unknown>,
    absIndex: number,
    event: KeyboardEvent | MouseEvent,
  ): void;
  (
    e: "action",
    action: TVueTableActionInfo,
    ids: unknown[],
    result: ActionResult,
    event?: KeyboardEvent | MouseEvent,
  ): void;
}>();

const filterFields = defineModel<string[]>("filterFields", { default: () => [] });
const columnNames = defineModel<string[]>("columnNames", { default: () => [] });
const columnWidths = defineModel<ColumnWidthsMap>("columnWidths", {
  default: () => ({}),
});
const sorters = defineModel<SortControl[]>("sorters", { default: () => [] });
/**
 * Opt-in for relevance-ranked backends (e.g. Atlas Search): while true AND a
 * search term is active, user sorters are omitted from the query so relevance
 * ranking survives (`forceSorters` still apply). Usable as a plain prop
 * (`:ignore-sorters-when-searched="true"` sets the configured default) or as
 * `v-model:ignore-sorters-when-searched` to observe/drive the runtime flag.
 */
const ignoreSortersWhenSearched = defineModel<boolean>("ignoreSortersWhenSearched", {
  default: false,
});
const selectedRows = defineModel<unknown[]>("selectedRows", { default: () => [] });

/**
 * Bidirectional URL bridge bound via `v-model:url-query`. When unbound the
 * feature is off (zero overhead); when bound the first query is gated on
 * tableDef settle + URL hydration so the table fetches once.
 */
const urlQuery = defineModel<string | undefined>("urlQuery", {
  default: () => undefined,
});
const urlQueryActive = useHasEmitListener("onUpdate:urlQuery").value;
const urlQueryReady = ref(!urlQueryActive);

const state = useTable(props.url, {
  limit: props.limit,
  // `select` is owned by `<AsTable>` / `<AsWindowTable>`, not the orchestrator.
  rowValueFn: props.rowValueFn,
  selectionPersistence: props.selectionPersistence,
  forceFilters: props.forceFilters,
  forceSorters: props.forceSorters,
  alwaysSelected: props.alwaysSelected,
  queryFn: props.queryFn,
  queryOnMount: props.queryOnMount,
  blockQuery: props.blockQuery,
  blockSize: props.blockSize,
  dragReleaseDebounceMs: props.dragReleaseDebounceMs,
  clientFactory: props.clientFactory,
  controls: props.controls,
  types: props.types,
  components: props.components,
  formTypes: props.formTypes,
  formComponents: props.formComponents,
  refreshOnAction: () => props.refreshOnAction,
  onActionResolved: (action, ids, result, event) => {
    emit("action", action, ids, result, event);
  },
  filterFields,
  columnNames,
  columnWidths,
  sorters,
  ignoreSortersWhenSearched,
  selectedRows,
  urlQueryReady: urlQueryActive ? urlQueryReady : undefined,
  onUrlQueryChange: urlQueryActive ? (s: string) => (urlQuery.value = s) : undefined,
  urlQuerySync: props.urlQuerySync,
  preset: props.preset,
});

if (urlQueryActive) {
  // Wait for tableDef (schema-driven parsing) AND preset bootstrap. Preset
  // writes its baseline first, URL overlays per-field on top — so a deep
  // link survives a preset that would otherwise clear filters, and preset's
  // non-URL fields are preserved. `preset.ready` is `true` when the feature
  // isn't wired, so non-preset tables stay single-step.
  watch(
    [() => state.tableDef.value, () => urlQuery.value, () => state.preset.ready.value],
    ([def, q, presetReady]) => {
      if (def === null || !presetReady) return;
      if (typeof q === "string" && q !== "") state.applyUrlQuery(q);
      if (!urlQueryReady.value) urlQueryReady.value = true;
    },
    { immediate: true },
  );
}

useRegisterMainActionListener(
  state,
  (req) => emit("main-action", req.row, req.absIndex, req.event),
  useHasEmitListener("onMainAction"),
);

const navBridge = useTableNavBridge(state);

// First-open latches: keep each lazy dialog unmounted (chunk unfetched) until
// the user first opens it, then leave it mounted so its close animation can
// play on dismiss. A plain `v-if="isOpen"` would tear the dialog out before
// the transition runs. The latch sticks to `true` once the source first goes
// truthy, so a plain `computed` won't do.
function latchOpened(source: () => unknown): Ref<boolean> {
  const latched = ref(false);
  watch(source, (v) => {
    if (v) latched.value = true;
  });
  return latched;
}
const everOpenedConfig = latchOpened(() => state.configDialogOpen.value);
const everOpenedFilter = latchOpened(() => state.filterDialogColumn.value);
const everOpenedPreset = latchOpened(() => state.preset.dialogOpen.value);

// Gates the lazy dialog mount so its chunk fetch overlaps the table's
// first render rather than waiting for a user click.
const hasInputFormActions = computed(() => {
  const a = state.tableDef.value?.actions;
  if (!a) return false;
  for (const list of [a.table, a.row, a.rows]) {
    for (const x of list) if (x.inputForm) return true;
  }
  return false;
});

defineExpose({ state, navBridge });
</script>

<template>
  <slot
    :table-def="state.tableDef.value"
    :loading-metadata="state.loadingMetadata.value"
    :all-columns="state.allColumns.value"
    :column-names="state.columnNames.value"
    :column-widths="state.columnWidths.value"
    :columns="state.columns.value"
    :filter-fields="state.filterFields.value"
    :filters="state.filters.value"
    :sorters="state.sorters.value"
    :results="state.results.value"
    :querying="state.querying.value"
    :querying-next="state.queryingNext.value"
    :total-count="state.totalCount.value"
    :loaded-count="state.loadedCount.value"
    :pagination="state.pagination.value"
    :query-error="state.queryError.value"
    :metadata-error="state.metadataError.value"
    :must-refresh="state.mustRefresh.value"
    :search-term="state.searchTerm.value"
    :ignore-sorters-when-searched="state.ignoreSortersWhenSearched.value"
    :selected-rows="state.selectedRows.value"
    :selected-count="state.selectedCount.value"
    :nav-bridge="navBridge"
    :query="state.query"
    :query-next="state.queryNext"
    :reset-filters="state.resetFilters"
    :show-config-dialog="state.showConfigDialog"
    :open-filter-dialog="state.openFilterDialog"
    :close-filter-dialog="state.closeFilterDialog"
    :set-field-filter="state.setFieldFilter"
    :remove-field-filter="state.removeFieldFilter"
    :add-filter-field="state.addFilterField"
    :remove-filter-field="state.removeFilterField"
    :actions="state.actions"
    :prompt="state.prompt"
  />

  <component
    v-if="everOpenedFilter || props.controls?.filterDialog"
    :is="props.controls?.filterDialog ?? AsFilterDialog"
  />
  <component
    v-if="everOpenedConfig || props.controls?.configDialog"
    :is="props.controls?.configDialog ?? AsConfigDialog"
  />
  <component :is="props.controls?.confirmDialog ?? AsConfirmDialog" />
  <component
    v-if="state.preset.available.value && (everOpenedPreset || props.controls?.presetDialog)"
    :is="props.controls?.presetDialog ?? AsPresetDialog"
  />

  <component
    v-if="hasInputFormActions || props.controls?.actionFormDialog"
    :is="props.controls?.actionFormDialog ?? LazyActionFormDialog"
  />
</template>
