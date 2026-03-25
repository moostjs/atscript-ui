import { watch } from "vue";
import type { ReactiveTableState } from "../types";

/**
 * Wire up selection reconciliation on results change.
 *
 * When results refresh, clears selection (or keeps only values
 * that still exist in the new results if keepAfterRefresh is true).
 */
export function useTableSelection(
  state: ReactiveTableState,
  opts?: { keepAfterRefresh?: boolean },
): void {
  const keepAfterRefresh = opts?.keepAfterRefresh ?? false;

  watch(
    () => state.results.value,
    (newResults) => {
      if (!keepAfterRefresh) {
        if (state.selectedRows.value.length > 0) state.selectedRows.value = [];
        return;
      }
      if (state.selectedRows.value.length === 0) return;
      const newValues = new Set(newResults.map((r) => state.rowValueFn(r)));
      const kept = state.selectedRows.value.filter((v) => newValues.has(v));
      if (kept.length !== state.selectedRows.value.length) {
        state.selectedRows.value = kept;
      }
    },
  );
}
