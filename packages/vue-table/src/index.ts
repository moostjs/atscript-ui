// ── Types ───────────────────────────────────────────────────
export type { TAsTableComponents, ReactiveTableState } from "./types";

// ── Composables ─────────────────────────────────────────────
export { useTable, type UseTableClient, type UseTableOptions } from "./composables/use-table";
export {
  useTableState,
  provideTableState,
  createTableState,
  TABLE_COMPONENTS_KEY,
  type CreateTableStateOptions,
  type TableStateInternals,
} from "./composables/use-table-state";
export {
  useTableQuery,
  type TableClient,
  type UseTableQueryOptions,
} from "./composables/use-table-query";
export { useTableSelection } from "./composables/use-table-selection";

// ── Component resolution ────────────────────────────────────
export { useTableComponent } from "./composables/use-table-component";

// ── Components ──────────────────────────────────────────────
export { default as AsTableRoot } from "./components/as-table-root.vue";
export { default as AsTable } from "./components/as-table.vue";
export { default as AsTableBase } from "./components/as-table-base.vue";
export { default as AsTableHeaderCell } from "./components/as-table-header-cell.vue";
export { default as AsTableCellValue } from "./components/as-table-cell-value.vue";
export { default as AsTableVirtualizer } from "./components/as-table-virtualizer.vue";

// ── Default components ──────────────────────────────────────
export { createDefaultTableComponents } from "./components/defaults";

// ── Utilities ───────────────────────────────────────────────
export { getColumnWidth } from "./utils/column-width";
export { getCellValue } from "./utils/get-cell-value";
export { formatCellValue } from "./utils/format-cell";
