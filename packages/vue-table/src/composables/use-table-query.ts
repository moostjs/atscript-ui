import { watch } from "vue";
import type { Uniquery, FilterExpr } from "@uniqu/core";
import type { SortControl } from "@atscript/ui";
import type { Client, PageResult } from "@atscript/db-client";
import { buildTableQuery, sameColumnSet, sortersEqual } from "@atscript/ui-table";
import type { ReactiveTableState } from "../types";
import type { TableStateInternals } from "./use-table-state";

export interface UseTableQueryOptions {
  /** Always-applied Uniquery filter expression (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /** Override the default query function. */
  queryFn?: (
    query: Uniquery,
    page: number,
    size: number,
  ) => Promise<PageResult<Record<string, unknown>>>;
  /** When true, queries are blocked. */
  blockQuery?: boolean;
}

/**
 * Wire up query execution on a table state.
 *
 * Queries are explicit via `state.query()` / `state.queryNext()`.
 * After the first query, watchers on columns/sorters/filters/search
 * automatically re-query on changes.
 */
export function useTableQuery(
  client: Client,
  state: ReactiveTableState,
  internals: TableStateInternals,
  opts?: UseTableQueryOptions,
): void {
  let generation = 0;
  let queryDetected = false;

  async function executeQuery(append: boolean) {
    state.mustRefresh.value = false;
    if (opts?.blockQuery) return;

    const thisGen = ++generation;
    const queryingRef = append ? state.queryingNext : state.querying;
    queryingRef.value = true;

    try {
      const query = buildTableQuery({
        visibleColumnPaths: state.columnNames.value,
        sorters: state.sorters.value,
        forceSorters: opts?.forceSorters,
        filters: state.filters.value,
        forceFilters: opts?.forceFilters,
        search: state.searchTerm.value || undefined,
      });

      const { page, itemsPerPage } = state.pagination.value;
      const fetcher =
        opts?.queryFn ??
        ((q: Uniquery, p: number, s: number) =>
          client.pages(q as Parameters<typeof client.pages>[0], p, s));
      const { data, count } = await fetcher(query, page, itemsPerPage);

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
      }
    }

    queryDetected = true;
  }

  function queryImmediate() {
    void executeQuery(false);
  }

  function queryNext() {
    const nextPage = state.pagination.value.page + 1;
    state.pagination.value = { ...state.pagination.value, page: nextPage };
    void executeQuery(true);
  }

  // After first query, auto re-query when the column set or sort order changes.
  // Column reordering alone doesn't affect $select — the set is what matters.
  watch(
    [() => state.columnNames.value, () => state.sorters.value],
    ([newCols, newSorters], [oldCols, oldSorters]) => {
      if (!queryDetected) return;
      if (sameColumnSet(oldCols, newCols) && sortersEqual(oldSorters, newSorters)) return;
      queryImmediate();
    },
  );

  // Filter/search changes just flag for refresh
  watch([() => state.filters.value, () => state.searchTerm.value], () => {
    state.mustRefresh.value = true;
  });

  internals.setQueryFns(queryImmediate, queryNext);
}
