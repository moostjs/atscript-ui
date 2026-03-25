import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import type { ColumnDef, TableDef } from "../table/types";

/** An option for select/radio fields — either a plain string or a `{ key, label }` pair. */
export type TFormEntryOptions = { key: string; label: string } | string;

// ── Value-help types (FK reference resolution) ──────────────

/** Extracted value-help metadata from an FK field's `.ref`. */
export interface ValueHelpInfo {
  /** HTTP path to query the target table (from @db.http.path). */
  path: string;
  /** The field on the target table that this FK references (from prop.ref.field, e.g. "id") —
   *  this is the value transferred to the FK field when the user picks a row. */
  targetField: string;
  /** Primary key field(s) on the target table (from @meta.id). */
  primaryKeys: string[];
  /** Display label field path (from @ui.dict.label or auto-inferred). */
  labelField: string;
  /** Description field path (from @ui.dict.descr, optional). */
  descrField?: string;
  /** Additional attribute field paths (from @ui.dict.attr). */
  attrFields: string[];
  /** The full target annotated type. */
  targetType: TAtscriptAnnotatedType;
}

/** Query parameters for a value-help request. */
export interface ValueHelpQuery {
  /** Free-text search (uses server $search if supported, else client-side regex). */
  search?: string;
  /** Field filters (Uniquery format). */
  filters?: Record<string, unknown>;
  /** Pagination offset. */
  skip?: number;
  /** Max items to return. */
  limit?: number;
  /** Fields to select (built from dict annotations). */
  select?: string[];
}

/** Result of a value-help query. */
export interface ValueHelpResult {
  items: Record<string, unknown>[];
  total?: number;
}

/** Metadata about a target table (from /meta endpoint). */
export interface TargetTableMeta {
  searchable: boolean;
  vectorSearchable: boolean;
  columns: ColumnDef[];
  primaryKeys: string[];
  tableDef: TableDef;
}

/** Options for creating a ValueHelpClient. */
export interface ValueHelpClientOptions {
  /** Base URL prefix (e.g., '' or '/api'). */
  baseUrl?: string;
  /** Custom fetch function (defaults to globalThis.fetch). */
  fetch?: typeof globalThis.fetch;
}

/** Client for querying target tables in value-help scenarios. */
export interface ValueHelpClient {
  /** Fetch target table meta. Returns undefined if 401/403 (no access). Cached. */
  getMeta(path: string): Promise<TargetTableMeta | undefined>;
  /** Query target table data. Handles search strategy automatically. */
  query(path: string, query: ValueHelpQuery): Promise<ValueHelpResult>;
}
