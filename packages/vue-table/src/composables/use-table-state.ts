import { shallowRef, ref, computed, provide, inject, type Component } from "vue";
import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui-core";
import { getVisibleColumns } from "@atscript/ui-core";
import { SelectionState, type FieldFilters, type SelectionOptions } from "@atscript/ui-table";
import type { ReactiveTableState, TAsTableComponents } from "../types";
import type { UseTableClient } from "./use-table";

const TABLE_KEY = "__as_table";

/** Everything provided by as-table-root to its subtree. */
export interface TableContext {
  state: ReactiveTableState;
  client: UseTableClient;
  components: TAsTableComponents;
}

export interface CreateTableStateOptions {
  /** Default page size. */
  limit?: number;
  /** Selection options. */
  selection?: SelectionOptions;
}

/** Internal handles returned alongside the public state. */
export interface TableStateInternals {
  /** Initialize state from a loaded table definition. */
  init(def: TableDef): void;
  /** Wire up query/queryNext functions from useTableQuery. */
  setQueryFns(query: () => void, queryNext: () => void): void;
}

/**
 * Create the reactive table state object.
 *
 * Uses `shallowRef` for arrays/objects (replaced wholesale) and
 * `ref` for scalars, following TABLE.md performance requirements.
 */
export function createTableState(opts?: CreateTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
} {
  const tableDef = shallowRef<TableDef | null>(null);
  const allColumns = shallowRef<ColumnDef[]>([]);
  const columns = shallowRef<ColumnDef[]>([]);
  const filters = shallowRef<FieldFilters>({});
  const sorters = shallowRef<SortControl[]>([]);
  const results = shallowRef<Record<string, unknown>[]>([]);
  const querying = ref(false);
  const queryingNext = ref(false);
  const totalCount = ref(0);
  const loadedCount = computed(() => results.value.length);
  const pagination = shallowRef<PaginationControl>({
    page: 1,
    itemsPerPage: opts?.limit ?? 50,
  });
  const queryError = shallowRef<Error | null>(null);
  const metadataError = shallowRef<Error | null>(null);
  const mustRefresh = ref(false);
  const searchTerm = ref("");
  const configDialogOpen = ref(false);

  const selectionOpts = opts?.selection ?? { mode: "none" as const };
  const selection = shallowRef(new SelectionState(selectionOpts));
  const selectedValues = computed(() => selection.value.getSelectedValues());
  const selectedCount = computed(() => selection.value.selectedCount);

  let _queryFn: (() => void) | undefined;
  let _queryNextFn: (() => void) | undefined;

  const state: ReactiveTableState = {
    tableDef,
    allColumns,
    columns,
    filters,
    sorters,
    results,
    querying,
    queryingNext,
    totalCount,
    loadedCount,
    pagination,
    queryError,
    metadataError,
    mustRefresh,
    searchTerm,
    configDialogOpen,
    selection,
    selectedValues,
    selectedCount,

    query() {
      _queryFn?.();
    },
    queryNext() {
      _queryNextFn?.();
    },
    resetFilters() {
      filters.value = {};
      if (pagination.value.page !== 1) {
        pagination.value = { ...pagination.value, page: 1 };
      }
    },
    showConfigDialog() {
      configDialogOpen.value = true;
    },
    setColumns(cols: ColumnDef[]) {
      columns.value = cols;
    },
    setSorters(s: SortControl[]) {
      sorters.value = s;
    },
  };

  const internals: TableStateInternals = {
    init(def: TableDef) {
      tableDef.value = def;
      allColumns.value = def.columns;
      columns.value = getVisibleColumns(def);
    },
    setQueryFns(q: () => void, qn: () => void) {
      _queryFn = q;
      _queryNextFn = qn;
    },
  };

  return { state, internals };
}

/** Provide the full table context to the component subtree. */
export function provideTableContext(ctx: TableContext): void {
  provide(TABLE_KEY, ctx);
}

/** Inject the full table context (throws if used outside as-table-root). */
export function useTableContext(): TableContext {
  const ctx = inject<TableContext>(TABLE_KEY);
  if (!ctx) {
    throw new Error(
      "[vue-table] useTableContext() called outside of <as-table-root>.",
    );
  }
  return ctx;
}

