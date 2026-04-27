import { computed, shallowRef, type ComputedRef, type Ref } from "vue";
import { togglePk, type SelectionMode } from "@atscript/ui-table";

type Row = Record<string, unknown>;

export interface SelectionApiOptions {
  /** Selection mode (default `"none"`). */
  mode?: SelectionMode;
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
  selectionMode: SelectionMode;
  rowValueFn: (row: Row) => unknown;
  isPkSelected: (pk: unknown) => boolean;
  ariaSelectedFor: (pk: unknown) => "true" | "false" | undefined;
  toggleActiveSelection: () => void;
}

export function createSelectionApi(
  opts: SelectionApiOptions | undefined,
  getActiveRow: () => Row | undefined,
): SelectionApi {
  const selectedRows = (opts?.selectedRows ?? shallowRef<unknown[]>([])) as Ref<unknown[]>;
  const selectedCount = computed(() => selectedRows.value.length);
  const selectionMode: SelectionMode = opts?.mode ?? "none";
  const rowValueFn = opts?.rowValueFn ?? ((row: Row) => row);

  const selectedSet = computed<ReadonlySet<unknown>>(() => new Set(selectedRows.value));

  function isPkSelected(pk: unknown): boolean {
    if (selectionMode === "none") return false;
    return selectedSet.value.has(pk);
  }
  function ariaSelectedFor(pk: unknown): "true" | "false" | undefined {
    if (selectionMode === "none") return undefined;
    return selectedSet.value.has(pk) ? "true" : "false";
  }

  function toggleActiveSelection(): void {
    const row = getActiveRow();
    if (row === undefined) return;
    selectedRows.value = togglePk(selectedRows.value, rowValueFn(row), selectionMode);
  }

  return {
    selectedRows,
    selectedCount,
    selectedSet,
    selectionMode,
    rowValueFn,
    isPkSelected,
    ariaSelectedFor,
    toggleActiveSelection,
  };
}
