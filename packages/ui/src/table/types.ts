import type { TAtscriptAnnotatedType, TSerializedAnnotatedType } from "@atscript/typescript/utils";
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
  readOnly: boolean;
  relations: RelationInfo[];
  fields: Record<string, FieldMeta>;
  type: TSerializedAnnotatedType;
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
  readOnly: boolean;
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
