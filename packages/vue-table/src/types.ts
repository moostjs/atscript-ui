import type { Component, ShallowRef, Ref, ComputedRef } from "vue";
import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui";
import type { FieldFilters, SelectionState, TableStateMethods } from "@atscript/ui-table";

/**
 * Component override map for table UI.
 *
 * Same pattern as vue-form's TAsTypeComponents: unstyled defaults
 * ship out of the box, user overrides any piece via this map.
 */
export interface TAsTableComponents {
  // Layout
  table?: Component;
  toolbar?: Component;
  pagination?: Component;

  // Cells & headers
  headerCell?: Component;
  cellValue?: Component;
  columnMenu?: Component;

  // Filters
  filterBar?: Component;
  filterToken?: Component;
  filterInput?: Component;
  filterDialog?: Component;

  // Config
  configDialog?: Component;
  fieldsSelector?: Component;
  sortersConfig?: Component;

  // Presets
  createPreset?: Component;
  managePresets?: Component;

  // Primitives (shared with vue-form where possible)
  input?: Component;
  select?: Component;
  checkbox?: Component;
  button?: Component;
  dialog?: Component;
  icon?: Component;
}

/**
 * Reactive table state — Vue implementation of the framework-agnostic
 * TableStateData + TableStateMethods interfaces.
 *
 * Arrays/objects use ShallowRef (replaced wholesale, no deep reactivity).
 * Scalars use Ref for fine-grained updates.
 */
export interface ReactiveTableState extends TableStateMethods {
  tableDef: ShallowRef<TableDef | null>;
  columns: ShallowRef<ColumnDef[]>;
  allColumns: ShallowRef<ColumnDef[]>;
  filters: ShallowRef<FieldFilters>;
  sorters: ShallowRef<SortControl[]>;
  results: ShallowRef<Record<string, unknown>[]>;
  querying: Ref<boolean>;
  queryingNext: Ref<boolean>;
  totalCount: Ref<number>;
  loadedCount: ComputedRef<number>;
  pagination: ShallowRef<PaginationControl>;
  queryError: ShallowRef<Error | null>;
  metadataError: ShallowRef<Error | null>;
  mustRefresh: Ref<boolean>;
  searchTerm: Ref<string>;
  configDialogOpen: Ref<boolean>;
  selection: ShallowRef<SelectionState>;
  selectedValues: ComputedRef<unknown[]>;
  selectedCount: ComputedRef<number>;
  /** Column currently open in the filter dialog (null when closed). */
  filterDialogColumn: ShallowRef<ColumnDef | null>;
}
