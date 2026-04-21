import { shallowRef, ref, computed, provide, inject, type Ref } from "vue";
import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui";
import {
  isFilled,
  type FieldFilters,
  type FilterCondition,
  type SelectionMode,
} from "@atscript/ui-table";
import type { Client } from "@atscript/db-client";
import type { ConfigTab, ReactiveTableState, TAsTableComponents } from "../types";

const TABLE_KEY = "__as_table";

/** Everything provided by as-table-root to its subtree. */
export interface TableContext {
  state: ReactiveTableState;
  client: Client;
  components: TAsTableComponents;
}

export interface CreateTableStateOptions {
  /** Default page size. */
  limit?: number;
  /** Selection mode (default: 'none'). */
  select?: SelectionMode;
  /** Extract unique value from a row for selection tracking. */
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  /** Preserve selection across data refreshes. */
  keepSelectedAfterRefresh?: boolean;
  /** External ref for filter field names (from defineModel). */
  filterFields?: Ref<string[]>;
  /** External ref for visible column names (from defineModel). */
  columnNames?: Ref<string[]>;
  /** External ref for sorters (from defineModel). */
  sorters?: Ref<SortControl[]>;
}

/** Internal handles returned alongside the public state. */
export interface TableStateInternals {
  /** Initialize state from a loaded table definition. */
  init(def: TableDef): void;
  /** Wire up query/queryNext functions from useTableQuery. */
  setQueryFns(query: () => void, queryNext: () => void): void;
  /** Wire up a callback that suppresses the next pagination watcher trigger. */
  setSuppressPaginationWatch(fn: () => void): void;
}

/**
 * Create the reactive table state object.
 *
 * Uses `shallowRef` for arrays/objects (replaced wholesale) and
 * `ref` for scalars, following TABLE.md performance requirements.
 *
 * When external refs are provided (from defineModel), they are used
 * directly — this enables v-model binding on AsTableRoot.
 */
export function createTableState(opts?: CreateTableStateOptions): {
  state: ReactiveTableState;
  internals: TableStateInternals;
} {
  const tableDef = shallowRef<TableDef | null>(null);
  const loadingMetadata = ref(true);
  const allColumns = shallowRef<ColumnDef[]>([]);

  // Model refs — use external if provided, otherwise create local
  const filterFields = opts?.filterFields ?? shallowRef<string[]>([]);
  const columnNames = opts?.columnNames ?? shallowRef<string[]>([]);
  const sorters = opts?.sorters ?? shallowRef<SortControl[]>([]);

  // columns is DERIVED from columnNames + allColumns
  const columns = computed<ColumnDef[]>(() => {
    const all = allColumns.value;
    if (all.length === 0 || columnNames.value.length === 0) return [];
    const map = new Map(all.map((c) => [c.path, c]));
    const result: ColumnDef[] = [];
    for (const name of columnNames.value) {
      const col = map.get(name);
      if (col) result.push(col);
    }
    return result;
  });

  const filters = shallowRef<FieldFilters>({});
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
  const configTab = ref<ConfigTab>("columns");
  const filterDialogColumn = shallowRef<ColumnDef | null>(null);

  const selectedRows = shallowRef<unknown[]>([]);
  const selectedCount = computed(() => selectedRows.value.length);
  const selectionMode: SelectionMode = opts?.select ?? "none";
  const rowValueFn = opts?.rowValueFn ?? ((row: Record<string, unknown>) => row);

  let _queryFn: (() => void) | undefined;
  let _queryNextFn: (() => void) | undefined;
  let _suppressPaginationWatch: (() => void) | undefined;

  function resetPagination() {
    if (pagination.value.page !== 1) {
      _suppressPaginationWatch?.();
      pagination.value = { ...pagination.value, page: 1 };
    }
  }

  const state: ReactiveTableState = {
    tableDef,
    loadingMetadata,
    columnNames,
    columns,
    allColumns,
    filterFields,
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
    configTab,
    filterDialogColumn,
    selectedRows,
    selectedCount,
    selectionMode,
    rowValueFn,

    query() {
      _queryFn?.();
    },
    queryNext() {
      _queryNextFn?.();
    },
    resetFilters() {
      filters.value = {};
      resetPagination();
    },
    showConfigDialog(tab?: ConfigTab) {
      configTab.value = tab ?? "columns";
      configDialogOpen.value = true;
    },
    setColumnNames(names: string[]) {
      columnNames.value = names;
    },
    setColumns(cols: ColumnDef[]) {
      columnNames.value = cols.map((c) => c.path);
    },
    setSorters(s: SortControl[]) {
      sorters.value = s;
    },
    addFilterField(path: string) {
      if (!filterFields.value.includes(path)) {
        filterFields.value = [...filterFields.value, path];
      }
    },
    removeFilterField(path: string) {
      filterFields.value = filterFields.value.filter((f) => f !== path);
      const { [path]: _, ...rest } = filters.value;
      filters.value = rest;
      resetPagination();
    },
    setFieldFilter(path: string, conditions: FilterCondition[]) {
      const filled = conditions.filter((c) => isFilled(c));
      if (filled.length === 0) {
        const { [path]: _, ...rest } = filters.value;
        filters.value = rest;
      } else {
        filters.value = { ...filters.value, [path]: conditions };
      }
      resetPagination();
    },
    removeFieldFilter(path: string) {
      const { [path]: _, ...rest } = filters.value;
      filters.value = rest;
      resetPagination();
    },
    openFilterDialog(column: ColumnDef) {
      filterDialogColumn.value = column;
    },
    closeFilterDialog() {
      filterDialogColumn.value = null;
    },
  };

  const internals: TableStateInternals = {
    init(def: TableDef) {
      tableDef.value = def;
      allColumns.value = def.columns;
    },
    setQueryFns(q: () => void, qn: () => void) {
      _queryFn = q;
      _queryNextFn = qn;
    },
    setSuppressPaginationWatch(fn: () => void) {
      _suppressPaginationWatch = fn;
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
    throw new Error("[vue-table] useTableContext() called outside of <as-table-root>.");
  }
  return ctx;
}
