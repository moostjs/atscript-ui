import { computed, shallowRef, type ComputedRef, type Ref } from "vue";
import { togglePk, type SelectionMode } from "@atscript/ui-table";

type Row = Record<string, unknown>;

export interface SelectionApiOptions {
  /** Extract a unique value from a row for selection tracking. */
  rowValueFn?: (row: Row) => unknown;
  /**
   * External ref to back `selectedRows`. When provided the framework reads
   * from and writes to this ref directly (identity preserved); otherwise a
   * local `shallowRef([])` is created.
   */
  selectedRows?: Ref<unknown[]>;
}

export interface SelectionApi {
  selectedRows: Ref<unknown[]>;
  selectedCount: ComputedRef<number>;
  selectedSet: ComputedRef<ReadonlySet<unknown>>;
  rowValueFn: (row: Row) => unknown;
  /**
   * Whether `pk` is in the current selection set. Mode-independent — in
   * `select="none"` the renderer should ensure `selectedRows` stays empty
   * (the renderer's mode-transition watcher in `<AsTable>` /
   * `<AsWindowTable>` does this), so `isPkSelected` returns false naturally
   * without needing to consult mode.
   */
  isPkSelected: (pk: unknown) => boolean;
  /**
   * Toggle the active row's selection in the requested mode. Mode is passed
   * by the caller because selection mode is a rendering concern owned by
   * the renderer's `:select` prop, not by state. `"none"` is a no-op.
   */
  toggleActiveSelection: (mode: SelectionMode) => void;
}

export function createSelectionApi(
  opts: SelectionApiOptions | undefined,
  getActiveRow: () => Row | undefined,
): SelectionApi {
  const selectedRows = (opts?.selectedRows ?? shallowRef<unknown[]>([])) as Ref<unknown[]>;
  const selectedCount = computed(() => selectedRows.value.length);
  const rowValueFn = opts?.rowValueFn ?? ((row: Row) => row);

  const selectedSet = computed<ReadonlySet<unknown>>(() => new Set(selectedRows.value));

  function isPkSelected(pk: unknown): boolean {
    return selectedSet.value.has(pk);
  }

  function toggleActiveSelection(mode: SelectionMode): void {
    if (mode === "none") return;
    const row = getActiveRow();
    if (row === undefined) return;
    selectedRows.value = togglePk(selectedRows.value, rowValueFn(row), mode);
  }

  return {
    selectedRows,
    selectedCount,
    selectedSet,
    rowValueFn,
    isPkSelected,
    toggleActiveSelection,
  };
}
