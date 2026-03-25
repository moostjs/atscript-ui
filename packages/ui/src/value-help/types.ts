import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

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
