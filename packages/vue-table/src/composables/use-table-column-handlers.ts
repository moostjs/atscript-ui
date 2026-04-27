import { reorderColumnNames, type ColumnReorderPosition } from "@atscript/ui-table";
import type { ColumnDef } from "@atscript/ui";
import type { ReactiveTableState } from "../types";

export interface TableColumnHandlers {
  onSort: (column: ColumnDef, direction: "asc" | "desc" | null) => void;
  onHide: (column: ColumnDef) => void;
  onFilter: (column: ColumnDef) => void;
  onFiltersOff: (column: ColumnDef) => void;
  onResetWidth: (column: ColumnDef) => void;
  onReorder: (fromPath: string, toPath: string, position: ColumnReorderPosition) => void;
  onClearFilters: () => void;
}

/**
 * Pure pass-through handlers shared between the pagination renderer
 * (`<AsTable>`) and the window renderer (`<AsWindowTableBase>`). Selection
 * and row-mouse handlers stay in their owning components because their
 * semantics diverge meaningfully (window has no "all" state; standalone
 * vs Reka renderModes need different gating).
 */
export function useTableColumnHandlers(state: ReactiveTableState): TableColumnHandlers {
  return {
    onSort(column, direction) {
      const rest = state.sorters.value.filter((s) => s.field !== column.path);
      state.sorters.value =
        direction === null ? rest : [...rest, { field: column.path, direction }];
    },
    onHide(column) {
      state.columnNames.value = state.columnNames.value.filter((n) => n !== column.path);
    },
    onFilter(column) {
      state.openFilterDialog(column);
    },
    onFiltersOff(column) {
      state.removeFieldFilter(column.path);
    },
    onResetWidth(column) {
      state.resetColumnWidth(column.path);
    },
    onReorder(fromPath, toPath, position) {
      state.columnNames.value = reorderColumnNames(
        state.columnNames.value,
        fromPath,
        toPath,
        position,
      );
    },
    onClearFilters() {
      state.resetFilters();
      if (state.searchTerm.value) state.searchTerm.value = "";
    },
  };
}
