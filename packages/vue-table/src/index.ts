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

// ── Components ──────────────────────────────────────────────
export { default as AsTableRoot } from "./components/as-table-root.vue";
