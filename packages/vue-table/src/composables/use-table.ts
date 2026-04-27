import {
  createTableDef,
  getMetaEntry,
  resetMetaCache,
  type ClientFactory,
  type SortControl,
} from "@atscript/ui";
import type { Client } from "@atscript/db-client";
import type { Ref } from "vue";
import type { FilterExpr } from "@uniqu/core";
import type { ColumnWidthsMap, SelectionMode } from "@atscript/ui-table";
import type { ReactiveTableState, TAsTableComponents } from "../types";
import { createTableState, provideTableContext, type QueryFn } from "./use-table-state";
import { useTableSelection, type SelectionPersistence } from "./use-table-selection";

/** Thin alias over `resetMetaCache` — retained so existing test code keeps working. */
export function clearTableCache() {
  resetMetaCache();
}

/**
 * Public composable options. Flat shape for Vue-template ergonomics
 * (`<AsTableRoot :limit="50" :select="multi">`). Internally translated into
 * the grouped `CreateTableStateOptions` before reaching `createTableState`.
 *
 * The data-engine `client` is resolved internally from the URL via
 * `getMetaEntry`; callers don't and can't pass it.
 */
export interface UseTableOptions {
  /** Default page size. */
  limit?: number;
  /** Selection mode (default: 'none'). */
  select?: SelectionMode;
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
  /** Component overrides for table rendering. */
  components?: TAsTableComponents;
  /** Whether to provide table context to the subtree (default: true). */
  provideContext?: boolean;
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

  const { state, internals } = createTableState({
    client: client as Client,
    limit: opts?.limit,
    selection: {
      mode: opts?.select,
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
    },
    window: {
      blockSize: opts?.blockSize,
      dragReleaseDebounceMs: opts?.dragReleaseDebounceMs,
    },
  });

  useTableSelection(state, { mode: opts?.selectionPersistence ?? "trim" });
  if (opts?.provideContext !== false) {
    provideTableContext({ state, client: client as Client, components: opts?.components ?? {} });
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
