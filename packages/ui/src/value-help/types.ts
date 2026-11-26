import type { FilterExpr } from "@atscript/db-client";

/** An option for select/radio fields — either a plain string or a `{ key, label }` pair. */
/**
 * A form option: a plain string, or `{ key, label }` — plus, for options derived from a
 * literal union or a boolean, the typed `value` (`true`, `3`) the field stores (since 0.1.165).
 */
export type TFormEntryOptions =
  | { key: string; label: string; value?: string | number | boolean }
  | string;

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
   * picker query. Comparisons with literal values only: the filter's host
   * references are in {@link hostFilter}. Since 0.1.148.
   */
  filter?: FilterExpr;
  /**
   * Target fields the filter pins with `=` — constant in the picker, hidden
   * from its columns. Since 0.1.148.
   */
  pinned?: string[];
  /**
   * The filter's host references (`targetField = Host.field`): in a form, the
   * picker also filters `target` by the value of the sibling field `local`,
   * left out while that field is empty (`valueHelpScope`). Table filters do
   * not apply them. In a form def, `local` is the sibling's path in the def:
   * for a field of a namespace object rendered inline it carries the parent
   * (`shipping.country`). Since 0.1.190.
   */
  hostFilter?: { target: string; local: string }[];
  /**
   * `@ui.valueHelp.fill`: in a form, a pick also writes the row's `target`
   * into the sibling field `local`. Only from the field's own binding or FK
   * help; a form keeps the fills it can write, `local` scoped as in
   * {@link hostFilter}. Since 0.1.190.
   */
  fill?: { local: string; target: string }[];
  /**
   * `@ui.valueHelp.column`: the target fields the picker dialogs show, in
   * order, instead of the dictionary view. Since 0.1.190.
   */
  columns?: string[];
}
