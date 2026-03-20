/** Selection mode. */
export type SelectionMode = "none" | "single" | "multi";

/** Options for creating a SelectionState. */
export interface SelectionOptions {
  mode: SelectionMode;
  /** Extract a unique value from a row (default: identity). */
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  /** Preserve selection across data refreshes. */
  keepAfterRefresh?: boolean;
}

/**
 * Framework-agnostic selection state.
 *
 * Manages a `Set` of selected row values with toggle, selectAll, and
 * reconcile-after-refresh logic. Framework wrappers (Vue/React) hold
 * this instance in a reactive ref and trigger updates on mutations.
 */
export class SelectionState {
  readonly mode: SelectionMode;
  readonly selected: Set<unknown> = new Set();
  readonly keepAfterRefresh: boolean;

  private readonly _rowValueFn: (row: Record<string, unknown>) => unknown;

  constructor(opts: SelectionOptions) {
    this.mode = opts.mode;
    this.keepAfterRefresh = opts.keepAfterRefresh ?? false;
    this._rowValueFn = opts.rowValueFn ?? ((row) => row);

    if (this.keepAfterRefresh && !opts.rowValueFn) {
      console.warn(
        "[ui-table] keepAfterRefresh requires a rowValueFn that returns a stable value (e.g. row ID). " +
          "The default identity function uses reference equality, which breaks across data refreshes.",
      );
    }
  }

  /** Extract the unique value for a row. */
  getRowValue(row: Record<string, unknown>): unknown {
    return this._rowValueFn(row);
  }

  /** Check if a row is selected. */
  isSelected(row: Record<string, unknown>): boolean {
    if (this.mode === "none") return false;
    return this.selected.has(this.getRowValue(row));
  }

  /** Toggle a row's selection state. */
  toggle(row: Record<string, unknown>): void {
    if (this.mode === "none") return;
    const value = this.getRowValue(row);
    if (this.selected.has(value)) {
      this.selected.delete(value);
    } else {
      if (this.mode === "single") this.selected.clear();
      this.selected.add(value);
    }
  }

  /** Select a row (no-op if already selected). */
  select(row: Record<string, unknown>): void {
    if (this.mode === "none") return;
    if (this.mode === "single") this.selected.clear();
    this.selected.add(this.getRowValue(row));
  }

  /** Deselect a row. */
  deselect(row: Record<string, unknown>): void {
    if (this.mode === "none") return;
    this.selected.delete(this.getRowValue(row));
  }

  /** Select all rows (multi mode only). */
  selectAll(rows: Record<string, unknown>[]): void {
    if (this.mode !== "multi") return;
    for (const row of rows) {
      this.selected.add(this.getRowValue(row));
    }
  }

  /** Clear all selections. */
  deselectAll(): void {
    this.selected.clear();
  }

  /**
   * After a data refresh, reconcile the selection set:
   * - If `keepAfterRefresh` is true, keep only values that exist in the new rows.
   * - Otherwise, clear all.
   */
  reconcileAfterRefresh(newRows: Record<string, unknown>[]): void {
    if (!this.keepAfterRefresh || this.selected.size === 0) {
      this.selected.clear();
      return;
    }
    const newValues = new Set(newRows.map((r) => this.getRowValue(r)));
    for (const v of this.selected) {
      if (!newValues.has(v)) this.selected.delete(v);
    }
  }

  /** Get selected values as an array. */
  getSelectedValues(): unknown[] {
    return [...this.selected];
  }

  /** Number of selected items. */
  get selectedCount(): number {
    return this.selected.size;
  }
}
