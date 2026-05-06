import { watch } from "vue";
import { trimSelection, type SelectionMode } from "@atscript/ui-table";
import type { ReactiveTableState } from "../types";

type Row = Record<string, unknown>;

export type SelectionPersistence = "clear" | "trim" | "persist";

/**
 * Renderer-owned cleanup for the `select` prop transition. Dropping into
 * `'none'` clears `selectedRows` so the next opt-in to multi-mode starts
 * clean; other transitions are no-ops (`'none' → 'multi'` already has an
 * empty selection, `'multi' → 'multi'` doesn't change semantics). The
 * getter is invoked once per change — NOT immediate, so the mount-time
 * default `'none'` doesn't clobber externally-seeded selections.
 *
 * Lives outside `useTableSelection` because selection mode is a renderer
 * concern (a prop, not state) — both `<AsTable>` and `<AsWindowTable>`
 * call this from their setup so the cleanup tracks the renderer's prop.
 */
export function useSelectModeReset(
  state: ReactiveTableState,
  selectGetter: () => SelectionMode,
): void {
  watch(selectGetter, (next, prev) => {
    if (next === "none" && prev !== "none" && state.selectedRows.value.length > 0) {
      state.selectedRows.value = [];
    }
  });
}

/**
 * Wire up selection reconciliation on results change.
 *
 * The watcher distinguishes results-replacement (query / invalidate /
 * pagination jump) from results-extension in EITHER direction (queryNext /
 * forward-merging loadRange / backward-merging loadRange) and only runs the
 * reconciliation logic on replacement. Backward extension prepends rows AND
 * decrements `resultsStart` — caught via the last-row reference identity
 * check, so scrolling upward doesn't silently mutate selection.
 *
 * Mode semantics on results-replacement:
 * - `"persist"` — no-op; the consumer's ref is untouched.
 * - `"trim"` (default) — keep the subset of selected PKs still present in the new results.
 * - `"clear"` — drop everything.
 */
export function useTableSelection(
  state: ReactiveTableState,
  opts?: { mode?: SelectionPersistence },
): void {
  const mode: SelectionPersistence = opts?.mode ?? "trim";

  // Mode-transition cleanup (`multi → none` clears `selectedRows`) lives
  // in `useSelectModeReset` above — renderer-owned because `select` is a
  // prop, not state.

  watch(
    [() => state.results.value, () => state.resultsStart.value] as const,
    ([newResults, newResultsStart], [oldResults, oldResultsStart]) => {
      if (mode === "persist") return;
      // Empty selection: extension detection AND trim/clear are all no-ops.
      // Bail before walking arrays.
      if (state.selectedRows.value.length === 0) return;

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

      if (mode === "clear") {
        state.selectedRows.value = [];
        return;
      }
      // mode === "trim" — trimSelection returns the same reference when nothing
      // was dropped, so a no-op assignment is harmless (Vue dedupes on identity).
      const presentPks = new Set<unknown>();
      for (const r of newArr) presentPks.add(state.rowValueFn(r));
      state.selectedRows.value = trimSelection(state.selectedRows.value, presentPks);
    },
  );
}
