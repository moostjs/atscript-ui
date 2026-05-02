import type { TAtscriptAnnotatedType, TSerializedAnnotatedType } from "@atscript/typescript/utils";
import type { TCrudPermissions, TDbActionInfo } from "@atscript/db-client";
import type { ValueHelpInfo } from "../value-help/types";

// ── MetaResponse types (structurally compatible with @atscript/db-client) ────

/** Search index metadata from the server. */
export interface SearchIndexInfo {
  name: string;
  description?: string;
  type?: "text" | "vector";
}

/** Relation summary in meta response. */
export interface RelationInfo {
  name: string;
  direction: "to" | "from" | "via";
  isArray: boolean;
}

/** Per-field capability flags. */
export interface FieldMeta {
  sortable: boolean;
  filterable: boolean;
}

/** Meta response from moost-db `/meta` endpoint. */
export interface MetaResponse {
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  primaryKeys: string[];
  /**
   * Preferred row identifier (UI/wire addressing). From
   * `@db.table.preferredId.uniqueIndex` — defaults to `primaryKeys` when the
   * server omits it (older servers / stub fixtures). Drives identifier object
   * construction for action POSTs and `'navigate'` URL `$1` substitution.
   */
  preferredId: string[];
  crud: TCrudPermissions;
  actions: TDbActionInfo[];
  relations: RelationInfo[];
  fields: Record<string, FieldMeta>;
  type: TSerializedAnnotatedType;
}

// ── Table action model ──────────────────────────────────────

/**
 * Server-declared actions grouped by `level`. Built by `createTableDef` from
 * `meta.actions[]` — sorted within each group by `(order ?? 0)` then
 * declaration order. `default.{table,row,rows}` is the first `default: true`
 * entry per level (or `undefined`). The synthesised `__remove` UI action is
 * never selected as a default.
 */
export interface TableActionsModel {
  table: TDbActionInfo[];
  row: TDbActionInfo[];
  rows: TDbActionInfo[];
  default: {
    table?: TDbActionInfo;
    row?: TDbActionInfo;
    rows?: TDbActionInfo;
  };
}

// ── Table definition types ──────────────────────────────────

/** Complete table definition — produced by createTableDef(). */
export interface TableDef {
  type: TAtscriptAnnotatedType;
  columns: ColumnDef[];
  /**
   * Flattened type tree (path → annotated prop). Empty Map for non-object roots.
   * Excludes phantom types. Consumers (e.g. cell-resolver) read this instead
   * of re-walking the type.
   */
  flatMap: Map<string, TAtscriptAnnotatedType>;
  primaryKeys: string[];
  /** Preferred row identifier — see `MetaResponse.preferredId`. */
  preferredId: string[];
  /** Per-op CRUD permissions advertised in `/meta`. Key absent → denied. */
  crud: TCrudPermissions;
  canRemove: boolean;
  /** Server-declared actions, grouped by level with defaults pre-resolved. */
  actions: TableActionsModel;
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  relations: RelationInfo[];
}

/** A single column definition — built from field metadata + annotations. */
export interface ColumnDef {
  /** Field path in dot-notation (e.g. 'address.city'). */
  path: string;
  /** Display label — from @meta.label or humanized path. */
  label: string;
  /** Display type — from @ui.table.type, then @ui.type, then inferred from designType. */
  type: string;
  /** Named component override from @ui.table.component — looked up in the table components map. */
  component?: string;
  /** Whether this column supports sorting. */
  sortable: boolean;
  /** Whether this column supports filtering. */
  filterable: boolean;
  /** Whether this column is visible by default. */
  visible: boolean;
  /** Default column width from @ui.table.width. */
  width?: string;
  /** Maximum length constraint from @expect.maxLen — used to derive default column width. */
  maxLen?: number;
  /** Initial column ordering from @ui.table.order (lower = first). */
  order: number;
  /** Enumerated options for union literal types (e.g. 'a' | 'b' | 'c'). */
  options?: { key: string; label: string }[];
  /** Value-help info for FK columns (from extractValueHelp). */
  valueHelpInfo?: ValueHelpInfo;
  /**
   * Synthesised, locked-chrome column. When `true`: header-cell column-menu
   * skipped, resize handle skipped, drag-reorder excluded, NOT in the
   * `columnNames` v-model. Used for the row-actions pseudo-column
   * (`path: '__actions'`).
   */
  fixed?: boolean;
}

// ── Query state types ───────────────────────────────────────

/** A single sort directive. */
export interface SortControl {
  field: string;
  direction: "asc" | "desc";
}

/** Pagination state. */
export interface PaginationControl {
  page: number;
  itemsPerPage: number;
}

/** Reactive query state for a table — mirrors @uniqu/core controls. */
export interface TableQueryState {
  sort?: SortControl[];
  pagination?: PaginationControl;
  search?: string;
  filters?: Record<string, unknown>;
}
