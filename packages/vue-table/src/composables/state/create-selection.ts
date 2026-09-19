import { computed, ref, shallowRef, type ComputedRef, type Ref } from "vue";
import { rowsToPks, togglePk, type SelectionMode } from "@atscript/ui-table";
import type { RowSelectableHook, RowSelectableVerdict } from "../../types";

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

/** Shared verdicts — frozen, so the common case allocates nothing per row. */
const SELECTABLE: RowSelectableVerdict = Object.freeze({ ok: true });
const NOT_SELECTABLE: RowSelectableVerdict = Object.freeze({ ok: false });

/** Normalise a {@link RowSelectableHook} return value. `""` carries no reason. */
function verdictOf(value: boolean | string | undefined | void): RowSelectableVerdict {
  if (value === undefined || value === true) return SELECTABLE;
  return value ? { ok: false, reason: value as string } : NOT_SELECTABLE;
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
   * Per-row selectability predicate, pushed in by the renderer's
   * `:rowSelectable` prop the way `rowDelete` is. Every selection path —
   * click, Space / Enter, select-all — gates on it here, so no renderer has
   * to re-implement the rule. Since 0.1.133.
   */
  rowSelectable: Ref<RowSelectableHook | undefined>;
  /**
   * Normalised verdict for one row. `index` is the row's position in what
   * the renderer is rendering (the absolute index in window mode).
   */
  isRowSelectable: (row: Row, index: number) => RowSelectableVerdict;
  /** The subset of `rows` the predicate lets through. */
  selectableRows: (rows: readonly Row[]) => Row[];
  /** How many of `rows` the predicate lets through, without building an array. */
  selectableCount: (rows: readonly Row[]) => number;
  /**
   * Select every eligible row in `rows`. An ineligible row that is ALREADY
   * selected stays selected: the predicate governs what the user may newly
   * pick, not what an earlier state (or the host's `v-model`) put there.
   *
   * `indexOf` maps a position in `rows` to the index handed to the
   * `rowSelectable` predicate — windowed callers pass it because their rows
   * come from a sparse cache keyed by ABSOLUTE index. Defaults to identity.
   */
  selectAll: (rows: readonly Row[], indexOf?: (position: number) => number) => void;
  /**
   * Toggle the active row's selection in the requested mode. Mode is passed
   * by the caller because selection mode is a rendering concern owned by
   * the renderer's `:select` prop, not by state. `"none"` is a no-op — and
   * so is a row the `rowSelectable` predicate rejects.
   */
  toggleActiveSelection: (mode: SelectionMode) => void;
}

export function createSelectionApi(
  opts: SelectionApiOptions | undefined,
  getActiveRow: () => Row | undefined,
  activeIndex: Ref<number>,
): SelectionApi {
  const selectedRows = (opts?.selectedRows ?? shallowRef<unknown[]>([])) as Ref<unknown[]>;
  const selectedCount = computed(() => selectedRows.value.length);
  const rowValueFn = opts?.rowValueFn ?? ((row: Row) => row);

  const selectedSet = computed<ReadonlySet<unknown>>(() => new Set(selectedRows.value));

  function isPkSelected(pk: unknown): boolean {
    return selectedSet.value.has(pk);
  }

  const rowSelectable = ref<RowSelectableHook | undefined>() as Ref<RowSelectableHook | undefined>;

  function isRowSelectable(row: Row, index: number): RowSelectableVerdict {
    const hook = rowSelectable.value;
    if (!hook) return SELECTABLE;
    return verdictOf(
      hook(row, {
        index,
        // A getter, not a value: most predicates never read `selected`, and
        // computing it eagerly would make every selection change a reason to
        // re-run every row's hooks in the renderer's memoised pass.
        get selected() {
          return isPkSelected(rowValueFn(row));
        },
      }),
    );
  }

  function selectableRows(rows: readonly Row[]): Row[] {
    if (!rowSelectable.value) return rows as Row[];
    return (rows as Row[]).filter((row, index) => isRowSelectable(row, index).ok);
  }

  function selectableCount(rows: readonly Row[]): number {
    if (!rowSelectable.value) return rows.length;
    let n = 0;
    for (let i = 0; i < rows.length; i++) if (isRowSelectable(rows[i]!, i).ok) n++;
    return n;
  }

  function selectAll(rows: readonly Row[], indexOf?: (position: number) => number): void {
    if (!rowSelectable.value) {
      selectedRows.value = rowsToPks(rows, rowValueFn);
      return;
    }
    const out: unknown[] = [];
    const seen = new Set<unknown>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const pk = rowValueFn(row);
      if (seen.has(pk)) continue;
      if (!isRowSelectable(row, indexOf ? indexOf(i) : i).ok && !isPkSelected(pk)) continue;
      seen.add(pk);
      out.push(pk);
    }
    selectedRows.value = out;
  }

  function toggleActiveSelection(mode: SelectionMode): void {
    if (mode === "none") return;
    const row = getActiveRow();
    if (row === undefined) return;
    if (!isRowSelectable(row, activeIndex.value).ok) return;
    selectedRows.value = togglePk(selectedRows.value, rowValueFn(row), mode);
  }

  return {
    selectedRows,
    selectedCount,
    selectedSet,
    rowValueFn,
    isPkSelected,
    rowSelectable,
    isRowSelectable,
    selectableRows,
    selectableCount,
    selectAll,
    toggleActiveSelection,
  };
}
