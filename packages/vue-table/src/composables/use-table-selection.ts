import { watch, triggerRef } from "vue";
import type { ReactiveTableState } from "../types";

/**
 * Wire up selection reactivity on a table state.
 *
 * Watches results changes and reconciles selection (clear or keep,
 * depending on `keepAfterRefresh` on the SelectionState).
 * Mutation methods trigger the shallowRef so Vue recomputes dependents.
 */
export function useTableSelection(state: ReactiveTableState): {
  toggle: (row: Record<string, unknown>) => void;
  select: (row: Record<string, unknown>) => void;
  deselect: (row: Record<string, unknown>) => void;
  selectAll: () => void;
  deselectAll: () => void;
  isSelected: (row: Record<string, unknown>) => boolean;
} {
  // Reconcile selection when results change
  watch(
    () => state.results.value,
    (newResults) => {
      state.selection.value.reconcileAfterRefresh(newResults);
      triggerRef(state.selection);
    },
  );

  const trigger = () => triggerRef(state.selection);

  return {
    toggle(row) {
      state.selection.value.toggle(row);
      trigger();
    },
    select(row) {
      state.selection.value.select(row);
      trigger();
    },
    deselect(row) {
      state.selection.value.deselect(row);
      trigger();
    },
    selectAll() {
      state.selection.value.selectAll(state.results.value);
      trigger();
    },
    deselectAll() {
      state.selection.value.deselectAll();
      trigger();
    },
    isSelected(row) {
      return state.selection.value.isSelected(row);
    },
  };
}
