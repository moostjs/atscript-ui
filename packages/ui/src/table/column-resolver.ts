import type { ColumnDef, TableDef } from "./types";

/** Get visible columns only, already sorted by order. */
export function getVisibleColumns(def: TableDef): ColumnDef[] {
  return def.columns.filter((c) => c.visible);
}

/** Get sortable columns. */
export function getSortableColumns(def: TableDef): ColumnDef[] {
  return def.columns.filter((c) => c.sortable);
}

/** Get filterable columns. */
export function getFilterableColumns(def: TableDef): ColumnDef[] {
  return def.columns.filter((c) => c.filterable);
}

/** Find a column by path. */
export function getColumn(def: TableDef, path: string): ColumnDef | undefined {
  return def.columns.find((c) => c.path === path);
}
