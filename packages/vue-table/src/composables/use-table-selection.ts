import { watch } from "vue";
import type { ReactiveTableState } from "../types";

type Row = Record<string, unknown>;

/**
 * Wire up selection reconciliation on results change.
 *
 * The watcher distinguishes results-replacement (query / invalidate /
 * pagination jump) from results-extension in EITHER direction (queryNext /
 * forward-merging loadRange / backward-merging loadRange) and only runs the
 * trim logic on replacement. Backward extension prepends rows AND decrements
 * `resultsStart` — caught via the last-row reference identity check, so
 * scrolling upward doesn't silently clear selection under the default
 * `keepAfterRefresh: false`.
 */
export function useTableSelection(
  state: ReactiveTableState,
  opts?: { keepAfterRefresh?: boolean },
): void {
  const keepAfterRefresh = opts?.keepAfterRefresh ?? false;

  watch(
    [() => state.results.value, () => state.resultsStart.value] as const,
    ([newResults, newResultsStart], [oldResults, oldResultsStart]) => {
      const oldArr = (oldResults ?? []) as Row[];
      const newArr = newResults as Row[];
      const oldStart = oldResultsStart ?? 0;
      const delta = newArr.length - oldArr.length;

      if (delta > 0 && oldArr.length > 0) {
        // Forward extension: same start anchor, same first-row reference.
        if (newResultsStart === oldStart && newArr[0] === oldArr[0]) return;
        // Backward extension: start shifted by delta, same last-row reference.
        if (
          newResultsStart === oldStart - delta &&
          newArr[newArr.length - 1] === oldArr[oldArr.length - 1]
        ) {
          return;
        }
      }

      if (!keepAfterRefresh) {
        if (state.selectedRows.value.length > 0) state.selectedRows.value = [];
        return;
      }
      if (state.selectedRows.value.length === 0) return;
      const newValues = new Set(newArr.map((r) => state.rowValueFn(r)));
      const kept = state.selectedRows.value.filter((v) => newValues.has(v));
      if (kept.length !== state.selectedRows.value.length) {
        state.selectedRows.value = kept;
      }
    },
  );
}
