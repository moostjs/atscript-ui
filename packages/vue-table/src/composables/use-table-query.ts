import { onScopeDispose, watch } from "vue";
import type { Uniquery, FilterExpr } from "@uniqu/core";
import type { SortControl } from "@atscript/ui";
import type { Client, PageResult } from "@atscript/db-client";
import { buildTableQuery, debounce, sameColumnSet, sortersEqual } from "@atscript/ui-table";
import type { ReactiveTableState } from "../types";
import type { TableStateInternals } from "./use-table-state";

const FILTER_DEBOUNCE_MS = 500;

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
 * The table is model-driven: any mutation to columnNames / sorters / filters /
 * searchTerm / pagination auto-triggers a re-query via watchers. Call sites
 * mutate state and never invoke `state.query()` to "apply" a change. The
 * public `state.query()` / `state.queryNext()` remain for user-initiated
 * refresh and append-on-scroll.
 */
export function useTableQuery(
  client: Client,
  state: ReactiveTableState,
  internals: TableStateInternals,
  opts?: UseTableQueryOptions,
): void {
  let generation = 0;
  let queryDetected = false;
  let skipPaginationWatch = 0;
  internals.setSuppressPaginationWatch(() => {
    skipPaginationWatch++;
  });

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
      // Clear prior results on a fresh fetch failure so the empty/error block
      // isn't stacked on stale rows. queryNext (append) keeps existing rows —
      // wiping mid-scroll would be jarring.
      if (!append) {
        state.results.value = [];
        state.totalCount.value = 0;
      }
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
    skipPaginationWatch++;
    state.pagination.value = { ...state.pagination.value, page: nextPage };
    void executeQuery(true);
  }

  watch(
    () => state.pagination.value,
    (next, prev) => {
      if (skipPaginationWatch > 0) {
        skipPaginationWatch--;
        return;
      }
      if (!queryDetected) return;
      if (next.page === prev.page && next.itemsPerPage === prev.itemsPerPage) return;
      queryImmediate();
    },
  );

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

  const debouncedAutoQuery = debounce(() => {
    if (queryDetected) queryImmediate();
  }, FILTER_DEBOUNCE_MS);

  onScopeDispose(() => debouncedAutoQuery.cancel());

  // Filters/search are noisy — coalesce into one debounced query, but flag
  // mustRefresh immediately so UI can show a "refresh pending" indicator.
  watch([() => state.filters.value, () => state.searchTerm.value], () => {
    state.mustRefresh.value = true;
    internals.resetPagination();
    debouncedAutoQuery();
  });

  internals.setQueryFns(queryImmediate, queryNext);
}
