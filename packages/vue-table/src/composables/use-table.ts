import { createTableDef, type MetaResponse } from "@atscript/ui-core";
import type { SelectionMode } from "@atscript/ui-table";
import type { ReactiveTableState } from "../types";
import { createTableState, provideTableState } from "./use-table-state";
import { useTableQuery, type TableClient, type UseTableQueryOptions } from "./use-table-query";
import { useTableSelection } from "./use-table-selection";

/** Client interface — structurally compatible with @atscript/db-client Client. */
export interface UseTableClient extends TableClient {
  meta(): Promise<MetaResponse>;
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
  /** Auto-query when metadata loads (default: true). */
  queryOnMount?: boolean;
}

/**
 * Main entry composable for table setup.
 *
 * 1. Creates reactive state
 * 2. Fetches metadata via `client.meta()` → `createTableDef()`
 * 3. Wires up reactive query execution
 * 4. Wires up selection
 * 5. Provides state to component subtree
 */
export function useTable(client: UseTableClient, opts?: UseTableOptions): ReactiveTableState {
  const { state, internals } = createTableState({
    limit: opts?.limit,
    selection: {
      mode: opts?.select ?? "none",
      rowValueFn: opts?.rowValueFn,
      keepAfterRefresh: opts?.keepSelectedAfterRefresh,
    },
  });

  // Wire up query execution
  useTableQuery(client, state, internals, opts);

  // Wire up selection reactivity
  useTableSelection(state);

  // Provide state to component subtree
  provideTableState(state);

  // Fetch metadata and initialize
  const queryOnMount = opts?.queryOnMount ?? true;

  client
    .meta()
    .then((meta) => {
      const def = createTableDef(meta);
      internals.init(def);

      if (queryOnMount) {
        state.query();
      }
    })
    .catch((err) => {
      state.metadataError.value = err instanceof Error ? err : new Error(String(err));
    });

  return state;
}
