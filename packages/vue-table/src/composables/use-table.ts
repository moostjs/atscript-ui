import type { Ref } from "vue";
import {
  createTableDef,
  getMetaEntry,
  getVisibleColumns,
  resetMetaCache,
  type ClientFactory,
  type SortControl,
} from "@atscript/ui";
import type { ColumnWidthsMap, SelectionMode } from "@atscript/ui-table";
import type { ReactiveTableState, TAsTableComponents } from "../types";
import { createTableState, provideTableContext } from "./use-table-state";
import { useTableQuery, type UseTableQueryOptions } from "./use-table-query";
import { useTableSelection } from "./use-table-selection";

/** Thin alias over `resetMetaCache` — retained so existing test code keeps working. */
export function clearTableCache() {
  resetMetaCache();
}

export interface UseTableOptions extends UseTableQueryOptions {
  /** Default page size (default: 50). */
  limit?: number;
  /** Selection mode (default: 'none'). */
  select?: SelectionMode;
  /** Extract unique value from a row for selection tracking. */
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  /** Preserve selection across data refreshes. */
  keepSelectedAfterRefresh?: boolean;
  /** Disable auto-reset/trim of selection on refresh. Use when selection is externally owned (e.g. value-help filter chips). */
  manageSelection?: boolean;
  /** Auto-query when metadata loads (default: true). */
  queryOnMount?: boolean;
  /** Factory to create a client from a URL. Only honored on the first `useTable`/`resolveValueHelp` call per URL — subsequent callers reuse the cached client. */
  clientFactory?: ClientFactory;
  /** Component overrides for table rendering. */
  components?: TAsTableComponents;
  /** Whether to provide table context to the subtree (default: true). */
  provideContext?: boolean;
  /** External model ref for filter field names. */
  filterFields?: Ref<string[]>;
  /** External model ref for visible column names. */
  columnNames?: Ref<string[]>;
  /** External model ref for per-column widths (each entry: `{ w, d }`). */
  columnWidths?: Ref<ColumnWidthsMap>;
  /** External model ref for sorters. */
  sorters?: Ref<SortControl[]>;
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
    limit: opts?.limit,
    select: opts?.select ?? "none",
    rowValueFn: opts?.rowValueFn,
    filterFields: opts?.filterFields,
    columnNames: opts?.columnNames,
    columnWidths: opts?.columnWidths,
    sorters: opts?.sorters,
  });

  useTableQuery(client, state, internals, opts);
  if (opts?.manageSelection !== false) {
    useTableSelection(state, { keepAfterRefresh: opts?.keepSelectedAfterRefresh });
  }
  if (opts?.provideContext !== false) {
    provideTableContext({ state, client, components: opts?.components ?? {} });
  }

  const queryOnMount = opts?.queryOnMount ?? true;

  defPromise
    .then((def) => {
      internals.init(def);
      if (state.columnNames.value.length === 0) {
        state.columnNames.value = getVisibleColumns(def).map((c) => c.path);
      }
      if (queryOnMount) {
        state.query();
      }
    })
    .catch((err) => {
      state.metadataError.value = err instanceof Error ? err : new Error(String(err));
    })
    .finally(() => {
      state.loadingMetadata.value = false;
    });

  return state;
}
