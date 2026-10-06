import type { FilterExpr } from "@atscript/db-client";

/** An option for select/radio fields — either a plain string or a `{ key, label }` pair. */
export type TFormEntryOptions = { key: string; label: string } | string;

// ── Value-help types (FK reference resolution) ──────────────

/**
 * Minimal sync probe output for a value-help–eligible prop.
 *
 * Emitted by `extractValueHelp(prop)` at def-construction time. Consumers use
 * `url` to key the lazy resolver (`resolveValueHelp(url)`) that fetches the
 * target's own `/meta` endpoint and returns the field-role details.
 */
export interface ValueHelpInfo {
  /** HTTP path to the value-help target (from the target's `@db.http.path`). */
  url: string;
  /**
   * Field on the target that this FK references (from `prop.ref.field`, e.g. "id").
   * This is the value committed to the FK field when the user picks a row.
   */
  targetField: string;
  /**
   * Static dictionary scope from `@ui.valueHelp`'s filter — AND'd into every
   * picker query. Since 0.1.148.
   */
  filter?: FilterExpr;
  /**
   * Target fields the filter pins with `=` — constant in the picker, hidden
   * from its columns. Since 0.1.148.
   */
  pinned?: string[];
}
