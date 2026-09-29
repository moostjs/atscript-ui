import { computed, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from "vue";
import { rowsToPks, togglePk, type SelectionMode } from "@atscript/ui-table";
import type { RowSelectableHook, RowSelectableVerdict, SelectAllState } from "../../types";

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

/**
 * The header tri-state from how many of the rows in scope are eligible and
 * how many of those are selected.
 */
export function toSelectAllState(selected: number, selectable: number): SelectAllState {
  if (selected === 0) return "none";
  return selected >= selectable ? "all" : "some";
}

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
  /** Loaded rows keyed by `rowValueFn` value — lazy, memoised per cache instance. */
  rowByValue: ComputedRef<ReadonlyMap<unknown, Row>>;
  /** The row behind a selection value (object → itself, scalar → {@link rowByValue}). */
  rowOf: (value: unknown) => Row | undefined;
  /** The loaded rows of the selection, in selection order; unloaded values left out. */
  selectedRowObjects: ComputedRef<Row[]>;
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
   * Add every eligible row in `rows` to the selection. What is already
   * selected stays selected — rows outside `rows` included, and an
   * ineligible row that is already picked: the predicate governs what the
   * user may newly pick, not what an earlier state (or the host's `v-model`)
   * put there.
   *
   * `indexOf` maps a position in `rows` to the index handed to the
   * `rowSelectable` predicate — windowed callers pass it because their rows
   * come from a sparse cache keyed by ABSOLUTE index. Defaults to identity.
   */
  selectAll: (rows: readonly Row[], indexOf?: (position: number) => number) => void;
  /**
   * Remove every eligible row in `rows` from the selection; selections
   * outside `rows` stay, and so does a picked row the predicate rejects (the
   * user can no more unpick it here than by clicking it). Since 0.1.142.
   */
  deselectAll: (rows: readonly Row[]) => void;
  /**
   * The header checkbox's action over `rows`: deselect them when every
   * eligible one is selected, otherwise select them. Since 0.1.142.
   */
  toggleAll: (rows: readonly Row[]) => void;
  /** Empty the selection — every pk, loaded or not, eligible or not. Since 0.1.142. */
  clearSelection: () => void;
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
  windowCache: ShallowRef<Map<number, Row>>,
): SelectionApi {
  const selectedRows = (opts?.selectedRows ?? shallowRef<unknown[]>([])) as Ref<unknown[]>;
  const selectedCount = computed(() => selectedRows.value.length);
  const rowValueFn = opts?.rowValueFn ?? ((row: Row) => row);

  // Every writer replaces `windowCache` wholesale, so this rebuilds once per
  // fetch — and only when a scalar selection value is actually resolved.
  const rowByValue = computed<ReadonlyMap<unknown, Row>>(() => {
    const map = new Map<unknown, Row>();
    for (const row of windowCache.value.values()) map.set(rowValueFn(row), row);
    return map;
  });

  function rowOf(value: unknown): Row | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "object") return value as Row;
    return rowByValue.value.get(value);
  }

  const selectedRowObjects = computed<Row[]>(() => {
    const out: Row[] = [];
    for (const value of selectedRows.value) {
      const row = rowOf(value);
      if (row) out.push(row);
    }
    return out;
  });

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

  function eligiblePks(rows: readonly Row[]): unknown[] {
    return rowsToPks(selectableRows(rows), rowValueFn);
  }

  function addPks(pks: readonly unknown[]): void {
    const current = selectedSet.value;
    const added = [...new Set(pks)].filter((pk) => !current.has(pk));
    if (added.length > 0) selectedRows.value = [...selectedRows.value, ...added];
  }

  function removePks(pks: readonly unknown[]): void {
    const drop = new Set(pks);
    const next = selectedRows.value.filter((pk) => !drop.has(pk));
    if (next.length !== selectedRows.value.length) selectedRows.value = next;
  }

  function selectAll(rows: readonly Row[], indexOf?: (position: number) => number): void {
    const eligible = indexOf
      ? rows.filter((row, i) => isRowSelectable(row, indexOf(i)).ok)
      : selectableRows(rows);
    addPks(rowsToPks(eligible, rowValueFn));
  }

  function deselectAll(rows: readonly Row[]): void {
    removePks(eligiblePks(rows));
  }

  function toggleAll(rows: readonly Row[]): void {
    const pks = eligiblePks(rows);
    const selected = pks.filter((pk) => selectedSet.value.has(pk)).length;
    if (toSelectAllState(selected, pks.length) === "all") removePks(pks);
    else addPks(pks);
  }

  function clearSelection(): void {
    if (selectedRows.value.length > 0) selectedRows.value = [];
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
    rowByValue,
    rowOf,
    selectedRowObjects,
    isPkSelected,
    rowSelectable,
    isRowSelectable,
    selectableRows,
    selectableCount,
    selectAll,
    deselectAll,
    toggleAll,
    clearSelection,
    toggleActiveSelection,
  };
}
