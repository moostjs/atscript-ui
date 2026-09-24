<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, type Component, type Ref } from "vue";
import type { ColumnDef, SortControl, ClientFactory } from "@atscript/ui";
import type { TAsTypeComponents } from "@atscript/vue-form";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type {
  ColumnWidthsMap,
  DisplayColumnDef,
  UnsupportedFilter,
  UrlQuerySync,
} from "@atscript/ui-table";
import { DEV } from "@atscript/ui-table";
import type {
  ActionResult,
  DroppedFieldsReport,
  PresetConfig,
  ReactiveTableState,
  RowActionsConfig,
  TAsCellTypeComponents,
  TAsTableControls,
  TVueTableActionInfo,
} from "../types";
import { finalizeTableState, useTable } from "../composables/use-table";
import {
  createStaticTableState,
  useRegisterMainActionListener,
  warnFieldsDropped,
  warnUnsupportedFilter,
} from "../composables/use-table-state";
import { useHasEmitListener } from "../composables/use-has-emit-listener";
import { useTableNavBridge } from "../composables/use-table-nav-bridge";
import type { SelectionPersistence } from "../composables/use-table-selection";
import type { Client, PageResult } from "@atscript/db-client";
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
    /**
     * Table endpoint URL (e.g. "/db/tables/products"). Omit it — and pass
     * `:rows` + `:columns` instead — to run the table in local mode over an
     * already-loaded array.
     */
    url?: string;
    /**
     * Local mode: render these rows instead of fetching. No client, no
     * `/meta` request and no metadata cache entry. Reactive — replacing the
     * array re-runs the local query (search / sort / paging stay live).
     * Requires `:columns`. Since 0.1.134.
     */
    rows?: Record<string, unknown>[];
    /**
     * Local mode: the columns to render. Read once at setup. Since 0.1.134.
     */
    columns?: ColumnDef[];
    /**
     * Local mode: field paths the search term matches (substring,
     * case-insensitive). Omit to disable search. Since 0.1.134.
     */
    searchPaths?: string[];
    /**
     * Local mode: sort `rows` in memory from the active sorters (default
     * `true`). Since 0.1.134.
     */
    localSort?: boolean;
    /**
     * Client-owned columns merged into the server's column list — labelled,
     * hideable, reorderable and preset-persisted like any column, but never
     * part of `$select`, server sorting or filters. Since 0.1.134.
     */
    displayColumns?: DisplayColumnDef[];
    /**
     * Per-screen policy for the row-actions cell: narrow the server's action
     * set (`include` / `exclude`), relabel it (`overrides`), and append
     * app-owned actions (`extra`). The server stays authoritative — an action
     * a row's `$actions` gated away never appears. Since 0.1.134.
     */
    rowActions?: RowActionsConfig;
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
    /**
     * Always-applied filter. App-authored: unlike presets and URLs it is
     * never pruned of fields the caller cannot see — keep it to fields every
     * role reads.
     */
    forceFilters?: FilterExpr;
    /** Always-applied sorters. Never pruned, like `forceFilters`. */
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
     * Maps a navigate action's interpolated href before it is used as an
     * anchor's `href` attribute or a mod/middle-click `window.open` target —
     * e.g. `(url) => router.resolve(url).href` for apps served under a
     * router base path. NOT applied on the plain-left-click invoke path (the
     * Client's `navigate` hook owns that URL). Default: identity.
     */
    resolveHref?: (url: string) => string;
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
    // Explicit: Vue casts an absent Boolean prop to `false`, which would
    // silently disable local sorting for every local-mode table.
    localSort: true,
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
  /**
   * A piece of a restored URL's filter that field filters cannot express
   * (cross-field OR, unknown operator, …) was left out, so the table shows a
   * broader result than the URL described. Once per piece, per restore.
   * Unbound → a dev-mode `console.warn` instead. Since 0.1.139.
   *
   * Since 0.1.140 a piece whose fields are all server-backed columns is kept
   * as a residual filter condition (`state.residualFilters`, shown as a
   * "custom filter" chip) and not reported — this event means "dropped".
   * `urlQuerySync: { residual: false }` restores the 0.1.139 behaviour.
   */
  (e: "unsupported-filter", issue: UnsupportedFilter): void;
  /**
   * Parts of a preset (with the local draft laid over it) or of a restored
   * URL that name fields this caller cannot use (hidden from their role, or gone
   * from the schema) were left out instead of failing the query. One report
   * per apply, only when something was dropped. Unbound → a dev-mode
   * `console.warn` instead. Since 0.1.141.
   *
   * Since 0.1.141 a URL filter piece that mixes such a field with usable
   * ones is reported here, not as `unsupported-filter`.
   */
  (e: "fields-dropped", report: DroppedFieldsReport): void;
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

/**
 * Local mode is decided once, at setup: `:rows` present means "render this
 * array", which is a different state factory (no client, no metadata fetch).
 * It cannot flip at runtime — a table that changes data source re-mounts.
 */
const localMode = props.rows !== undefined;

if (!localMode && !props.url) {
  throw new Error("[vue-table] <AsTableRoot> requires either :url or :rows (local mode).");
}

/**
 * Build the local-mode state: a `createStaticTableState` over the `:rows`
 * array, provided to the subtree exactly like the fetching path so cells,
 * keyboard nav, header slots, selection and the config dialog all work.
 * Features that need a client are inert here and warned about once.
 */
function createLocalState(): ReactiveTableState {
  // Dev-only: these are authoring mistakes, and the strings have no business
  // in a production bundle.
  if (DEV) {
    if (props.url) {
      console.warn("[vue-table] <AsTableRoot>: :rows is set, so :url is ignored (local mode).");
    }
    if (props.preset) {
      console.warn("[vue-table] <AsTableRoot>: presets need a server and are off in local mode.");
    }
    if (urlQueryActive) {
      console.warn("[vue-table] <AsTableRoot>: v-model:urlQuery is not wired in local mode.");
    }
    if (props.queryFn) {
      console.warn("[vue-table] <AsTableRoot>: :queryFn is ignored in local mode.");
    }
  }

  const { state: localState } = createStaticTableState({
    // Getter, not a snapshot: the local query function re-reads it, so a new
    // array is enough to re-render.
    rows: () => props.rows ?? [],
    columns: props.columns ?? [],
    searchPaths: props.searchPaths,
    localSort: props.localSort,
    displayColumns: props.displayColumns,
    limit: props.limit,
    queryOnMount: props.queryOnMount,
    selection: { rowValueFn: props.rowValueFn, selectedRows },
    model: { filterFields, columnNames, columnWidths, sorters },
    actions: {
      resolveHref: props.resolveHref,
      onResolved: (action, ids, result, event) => emit("action", action, ids, result, event),
    },
  });

  // Same tail as the fetching path (`useTable`): selection persistence, then
  // the context every child injects.
  finalizeTableState(localState, {} as Client, {
    selectionPersistence: props.selectionPersistence,
    controls: props.controls,
    types: props.types,
    components: props.components,
    formTypes: props.formTypes,
    formComponents: props.formComponents,
  });
  watch(
    () => props.rows,
    () => localState.query({ silent: true }),
  );
  return localState;
}

const hasUnsupportedFilterListener = useHasEmitListener("onUnsupportedFilter");
const hasFieldsDroppedListener = useHasEmitListener("onFieldsDropped");

const state = localMode
  ? createLocalState()
  : useTable(props.url!, {
      limit: props.limit,
      // `select` is owned by `<AsTable>` / `<AsWindowTable>`, not the orchestrator.
      rowValueFn: props.rowValueFn,
      selectionPersistence: props.selectionPersistence,
      forceFilters: props.forceFilters,
      forceSorters: props.forceSorters,
      alwaysSelected: props.alwaysSelected,
      queryFn: props.queryFn,
      queryOnMount: props.queryOnMount,
      // Getter, not a snapshot: a table mounted while blocked must start fetching
      // as soon as the host clears the flag.
      blockQuery: () => props.blockQuery === true,
      blockSize: props.blockSize,
      dragReleaseDebounceMs: props.dragReleaseDebounceMs,
      clientFactory: props.clientFactory,
      controls: props.controls,
      types: props.types,
      components: props.components,
      formTypes: props.formTypes,
      formComponents: props.formComponents,
      refreshOnAction: () => props.refreshOnAction,
      resolveHref: props.resolveHref,
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
      // The listener is checked per report, not once at setup.
      onUnsupportedFilter: (issue) =>
        hasUnsupportedFilterListener.value
          ? emit("unsupported-filter", issue)
          : warnUnsupportedFilter(issue),
      onFieldsDropped: (report) =>
        hasFieldsDroppedListener.value ? emit("fields-dropped", report) : warnFieldsDropped(report),
      preset: props.preset,
      displayColumns: props.displayColumns,
    });

// Renderer-pushed, like `<AsTable :row-delete>`: the row-actions cell reads
// the policy off the state so a standalone `<AsRowActions>` honours it too.
watch(
  () => props.rowActions,
  (value) => {
    state.rowActions.value = value;
  },
  { immediate: true },
);

if (urlQueryActive && !localMode) {
  // Every pass — deep-link hydration on mount, then client-side navigation
  // and Back/Forward — hands the URL to `applyUrlQuery`, which decides by the
  // URL itself: a `$snapshot` URL (every URL the table writes) replaces the
  // filters and sorters, a marker-less app deep link overlays the ones the
  // table booted with. The first pass waits for tableDef (schema-driven
  // parsing) AND preset bootstrap, so that boot state is the preset's; it then
  // opens `urlQueryReady`, which gates the first fetch. `preset.ready` is
  // `true` when the feature isn't wired, so non-preset tables stay single-step.
  //
  // Later passes compare the query string rather than just reacting to the
  // watcher, because the watcher also fires on tableDef and preset.ready. The
  // echo guard inside `applyUrlQuery` cannot stand in for that: an overlay
  // pass re-primes `lastEmittedUrl` from the overlaid state, which carries the
  // baseline's fields and no longer equals the deep-link URL — a same-URL
  // re-fire would sail past it.
  let lastSeenQuery: string | undefined;
  watch(
    [() => state.tableDef.value, () => urlQuery.value, () => state.preset.ready.value],
    ([def, q, presetReady]) => {
      if (def === null || !presetReady) return;
      const query = typeof q === "string" ? q : "";
      if (query !== lastSeenQuery) state.applyUrlQuery(query);
      lastSeenQuery = query;
      urlQueryReady.value = true;
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
    :residual-filters="state.residualFilters.value"
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
    :set-residual-filters="state.setResidualFilters"
    :remove-residual-filter="state.removeResidualFilter"
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
