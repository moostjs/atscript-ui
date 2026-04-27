// ── Types ───────────────────────────────────────────────────
export type {
  TAsTableComponents,
  ReactiveTableState,
  ColumnMenuConfig,
  ConfigTab,
  NavKeyOptions,
  TableNavBridge,
  MainActionRequest,
  QueryErrorKind,
} from "./types";

// ── Composables ─────────────────────────────────────────────
export { useTable, clearTableCache, type UseTableOptions } from "./composables/use-table";
export {
  setDefaultClientFactory,
  getDefaultClientFactory,
  resetDefaultClientFactory,
  type ClientFactory,
} from "@atscript/ui";
export {
  useTableContext,
  useTableContextOptional,
  createTableState,
  createStaticTableState,
  type TableContext,
  type CreateTableStateOptions,
  type CreateStaticTableStateOptions,
  type TableStateInternals,
} from "./composables/use-table-state";
export { useTableSelection, type SelectionPersistence } from "./composables/use-table-selection";
export { useTableNavBridge } from "./composables/use-table-nav-bridge";
export { useTableFilter } from "./composables/use-table-filter";
export { useTableSearch } from "./composables/use-table-search";

// ── Component resolution ────────────────────────────────────
export { useTableComponent } from "./composables/use-table-component";

// ── Public components (Tier 1 — user-tagged) ────────────────
export { default as AsTableRoot } from "./components/as-table-root.vue";
export { default as AsTable } from "./components/as-table.vue";
export { default as AsWindowTable } from "./components/as-window-table.vue";
export { default as AsFilters } from "./components/as-filters.vue";

// ── Default implementations (Tier 2 — swap targets) ─────────
export { createDefaultTableComponents } from "./composables/create-default-table-components";
export {
  AsColumnMenu,
  AsConfigDialog,
  AsFilterDialog,
  AsFilterField,
  AsFilterInput,
  AsTableCellValue,
  AsTableHeaderCell,
} from "./components/defaults";

// ── Utilities ───────────────────────────────────────────────
export { getColumnWidth } from "./utils/column-width";
export { getCellValue } from "./utils/get-cell-value";
export { formatCellValue } from "./utils/format-cell";
