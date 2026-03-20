import { watch, onBeforeUnmount } from "vue";
import type { Uniquery, FilterExpr } from "@uniqu/core";
import type { SortControl } from "@atscript/ui-core";
import { buildTableQuery, debounce } from "@atscript/ui-table";
import type { ReactiveTableState } from "../types";
import type { TableStateInternals } from "./use-table-state";

/** Client interface — structurally compatible with @atscript/db-client Client. */
export interface TableClient {
  findManyWithCount(query: Uniquery): Promise<{ data: Record<string, unknown>[]; count: number }>;
}

export interface UseTableQueryOptions {
  /** Always-applied Uniquery filter expression (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /** Override the default query function. */
  queryFn?: (query: Uniquery) => Promise<{ data: Record<string, unknown>[]; count: number }>;
  /** When true, queries are blocked. */
  blockQuery?: boolean;
  /** Debounce delay in ms (default: 200). */
  debounceMs?: number;
}

/**
 * Wire up reactive query execution on a table state.
 *
 * Watches columns/sorters/filters/pagination/searchTerm changes,
 * debounces, builds Uniquery via `buildTableQuery()` (ui-table),
 * and calls the client to fetch results.
 */
export function useTableQuery(
  client: TableClient,
  state: ReactiveTableState,
  internals: TableStateInternals,
  opts?: UseTableQueryOptions,
): void {
  let generation = 0;
  const ms = opts?.debounceMs ?? 200;

  async function executeQuery(append: boolean) {
    if (opts?.blockQuery) return;

    const thisGen = ++generation;
    const queryingRef = append ? state.queryingNext : state.querying;
    queryingRef.value = true;
    state.mustRefresh.value = false;

    try {
      const query = buildTableQuery({
        visibleColumnPaths: state.columns.value.map((c) => c.path),
        sorters: state.sorters.value,
        forceSorters: opts?.forceSorters,
        filters: state.filters.value,
        forceFilters: opts?.forceFilters,
        pagination: state.pagination.value,
        search: state.searchTerm.value || undefined,
      });

      const fetcher = opts?.queryFn ?? ((q: Uniquery) => client.findManyWithCount(q));
      const { data, count } = await fetcher(query);

      // Discard stale results if a newer query was started
      if (thisGen !== generation) return;

      if (append) {
        state.results.value = [...state.results.value, ...data];
      } else {
        state.results.value = data;
      }
      state.totalCount.value = count;
      state.queryError.value = null;
    } catch (err) {
      if (thisGen !== generation) return;
      state.queryError.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      if (thisGen === generation) {
        queryingRef.value = false;

        // Re-trigger if state changed during the query
        if (state.mustRefresh.value) {
          state.mustRefresh.value = false;
          debouncedQuery();
        }
      }
    }
  }

  function queryReplace() {
    // Reset to page 1 on filter/sort changes (no separate watcher needed)
    if (state.pagination.value.page !== 1) {
      state.pagination.value = { ...state.pagination.value, page: 1 };
    }
    void executeQuery(false);
  }

  function queryNext() {
    const nextPage = state.pagination.value.page + 1;
    state.pagination.value = { ...state.pagination.value, page: nextPage };
    void executeQuery(true);
  }

  const debouncedQuery = debounce(queryReplace, ms);

  // Watch state changes and trigger debounced query
  watch(
    [
      () => state.columns.value,
      () => state.sorters.value,
      () => state.filters.value,
      () => state.searchTerm.value,
    ],
    () => {
      if (generation > 0 && state.querying.value) {
        state.mustRefresh.value = true;
      } else {
        debouncedQuery();
      }
    },
  );

  // Wire up state.query() and state.queryNext()
  internals.setQueryFns(() => executeQuery(false), queryNext);

  onBeforeUnmount(() => {
    debouncedQuery.cancel();
  });
}
