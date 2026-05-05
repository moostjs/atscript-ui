import {
  createTableDef,
  getMetaEntry,
  resetMetaCache,
  type ClientFactory,
  type SortControl,
} from "@atscript/ui";
import type { TAsTypeComponents } from "@atscript/vue-form";
import type { Client } from "@atscript/db-client";
import type { Component, Ref } from "vue";
import type { FilterExpr } from "@uniqu/core";
import type { ColumnWidthsMap, UrlQuerySync } from "@atscript/ui-table";
import type {
  ActionResult,
  PresetConfig,
  ReactiveTableState,
  TAsCellTypeComponents,
  TAsTableControls,
  TVueTableActionInfo,
} from "../types";
import { createTableState, provideTableContext, type QueryFn } from "./use-table-state";
import { useTableSelection, type SelectionPersistence } from "./use-table-selection";
import { injectPresetsApp } from "./as-presets-app";
import { useLocalDraft } from "./use-local-draft";
import { usePresets } from "./use-presets";
import { DEFAULT_AVAILABLE_ASPECTS } from "./state/create-preset-state";

/** Thin alias over `resetMetaCache` — retained so existing test code keeps working. */
export function clearTableCache() {
  resetMetaCache();
}

/**
 * Public composable options. Flat shape for Vue-template ergonomics
 * (`<AsTableRoot :limit="50">`). Internally translated into the grouped
 * `CreateTableStateOptions` before reaching `createTableState`.
 *
 * The data-engine `client` is resolved internally from the URL via
 * `getMetaEntry`; callers don't and can't pass it.
 */
export interface UseTableOptions {
  /** Default page size. */
  limit?: number;
  /** Extract unique value from a row for selection tracking. */
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  /**
   * Selection write policy applied on every results-replacement.
   * - `"clear"` — drop everything on refresh.
   * - `"trim"` (default) — keep the subset of PKs that still exist in the new results.
   * - `"persist"` — never write to `selectedRows`; full consumer ownership.
   */
  selectionPersistence?: SelectionPersistence;
  /** External ref for filter field names (from defineModel). */
  filterFields?: Ref<string[]>;
  /** External ref for visible column names (from defineModel). */
  columnNames?: Ref<string[]>;
  /** External ref for per-column widths (from defineModel). */
  columnWidths?: Ref<ColumnWidthsMap>;
  /** External ref for sorters (from defineModel). */
  sorters?: Ref<SortControl[]>;
  /**
   * External ref for selected rows (from `defineModel`/v-model or any external
   * source). Identity is preserved — the framework reads from and writes to
   * this ref directly.
   */
  selectedRows?: Ref<unknown[]>;
  /** Always-applied Uniquery filter expression (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /** Override the default query function. */
  queryFn?: QueryFn;
  /** Auto-query when metadata loads (default: true). */
  queryOnMount?: boolean;
  /** When true, all triggers (query/queryNext/loadRange) early-return. */
  blockQuery?: boolean;
  /** Page-alignment unit for `loadRange` and the `queryNext` extension. */
  blockSize?: number;
  /** Debounce window for the topIndex/viewportRowCount watcher. */
  dragReleaseDebounceMs?: number;
  /** Factory to create a client from a URL. Only honored on the first `useTable`/`resolveValueHelp` call per URL — subsequent callers reuse the cached client. */
  clientFactory?: ClientFactory;
  /** Skin-slot overrides for table chrome (header cells, filter dialog, column menu, etc.). */
  controls?: TAsTableControls;
  /** Cell-type → component dispatch map. Use {@link createDefaultCellTypes} to seed defaults. */
  types?: TAsCellTypeComponents;
  /** Named cell-component overrides — looked up by `@ui.table.component "name"`. */
  components?: Record<string, Component>;
  /**
   * Form-type → component dispatch map for the action-form dialog. Defaults to
   * `createDefaultTypes()` from `@atscript/vue-form`.
   */
  formTypes?: TAsTypeComponents;
  /** Named form-component overrides for the action-form dialog. */
  formComponents?: Record<string, Component>;
  /** Whether to provide table context to the subtree (default: true). */
  provideContext?: boolean;
  /**
   * Refetch policy for `state.actions.invoke`. When `true` (default),
   * successful `'backend'` / `'__remove'` invocations call `state.query()`.
   */
  refreshOnAction?: () => boolean;
  /** Bridge for `<AsTableRoot>`'s `@action` emit; see `TableActionsOptions.onResolved`. */
  onActionResolved?: (
    action: TVueTableActionInfo,
    ids: unknown[],
    result: ActionResult,
    event?: KeyboardEvent | MouseEvent,
  ) => void;
  /**
   * Gate the initial `scheduleQuery("initial")` until this ref is `true`.
   * `<AsTableRoot>` sets it `false` while it hydrates from `v-model:urlQuery`
   * so the first fetch composes URL + defaults into one request. Omit when
   * not using the URL bridge — the gate stays implicitly open.
   */
  urlQueryReady?: Ref<boolean>;
  /**
   * Called whenever a state mutation produces a new URL query string.
   * Omitting it disables the URL emitter — the feature is opt-in.
   */
  onUrlQueryChange?: (urlString: string) => void;
  /**
   * Per-aspect opt-in/out for the URL bridge — gate filters / sorters /
   * search / pagination independently. Static; captured once at setup.
   * Default (omitted): full sync.
   */
  urlQuerySync?: UrlQuerySync;

  /**
   * Preset feature config — opt-in. Omit to disable presets entirely
   * (`<AsPresetPicker>` / `<AsPresetDialog>` render nothing). When set,
   * `url` and `tableKey` are required.
   */
  preset?: PresetConfig;
}

/**
 * Main entry composable for table setup.
 *
 * @param url — Table endpoint URL (e.g. "/db/tables/products")
 */
export function useTable(url: string, opts?: UseTableOptions): ReactiveTableState {
  const entry = getMetaEntry(url, opts?.clientFactory);
  if (!entry.tableDef) {
    entry.tableDef = Promise.all([entry.meta, entry.type]).then(([meta, type]) =>
      createTableDef(meta, type),
    );
  }
  const { client } = entry;
  const defPromise = entry.tableDef;

  const preset = opts?.preset;
  const presetsHandle = preset
    ? usePresets({
        url: preset.url,
        tableKey: preset.tableKey,
        app: preset.app,
        clientFactory: opts?.clientFactory,
        systemPresets: preset.systemPresets,
      })
    : null;
  const draftHandle = preset
    ? useLocalDraft({
        // Resolve the same `app` value `usePresets` saw so the storage key matches.
        app: injectPresetsApp(preset.app),
        tableKey: preset.tableKey,
        enabled: preset.persistDrafts ?? false,
        availableAspects: preset.aspects ?? DEFAULT_AVAILABLE_ASPECTS,
      })
    : null;

  const { state, internals } = createTableState({
    client: client as Client,
    limit: opts?.limit,
    selection: {
      rowValueFn: opts?.rowValueFn,
      selectedRows: opts?.selectedRows,
    },
    model: {
      filterFields: opts?.filterFields,
      columnNames: opts?.columnNames,
      columnWidths: opts?.columnWidths,
      sorters: opts?.sorters,
    },
    query: {
      fn: opts?.queryFn,
      forceFilters: opts?.forceFilters,
      forceSorters: opts?.forceSorters,
      blockQuery: opts?.blockQuery,
      queryOnMount: opts?.queryOnMount,
      urlQueryReady: opts?.urlQueryReady,
      onUrlQueryChange: opts?.onUrlQueryChange,
      urlQuerySync: opts?.urlQuerySync,
    },
    window: {
      blockSize: opts?.blockSize,
      dragReleaseDebounceMs: opts?.dragReleaseDebounceMs,
    },
    actions: {
      refreshOnAction: opts?.refreshOnAction,
      onResolved: opts?.onActionResolved,
    },
    preset: {
      presetsHandle,
      draftHandle,
      availableAspects: preset?.aspects,
      persistDrafts: preset?.persistDrafts ?? false,
    },
  });

  useTableSelection(state, { mode: opts?.selectionPersistence ?? "trim" });
  if (opts?.provideContext !== false) {
    provideTableContext({
      state,
      client: client as Client,
      controls: opts?.controls ?? {},
      types: opts?.types,
      components: opts?.components,
      formTypes: opts?.formTypes,
      formComponents: opts?.formComponents,
    });
  }

  defPromise
    .then((def) => {
      internals.init(def);
    })
    .catch((err) => {
      state.metadataError.value = err instanceof Error ? err : new Error(String(err));
    })
    .finally(() => {
      state.loadingMetadata.value = false;
    });

  return state;
}
