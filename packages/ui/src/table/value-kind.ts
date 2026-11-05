import type { TFormEntryOptions } from "../value-help/types";
import type { ColumnValueKind } from "./types";

/** Storage kinds that hold plain numbers (a `timestamp` is epoch ms, but filters treat it as a date). */
export const NUMERIC_VALUE_KINDS: ReadonlySet<ColumnValueKind> = new Set<ColumnValueKind>([
  "number",
  "integer",
  "decimal",
]);

/**
 * The typed value of an option — a column's or a form field's — the literal
 * itself (`true`, `3`, `'a'`), falling back to the string `key` for a hand-built
 * option that has no `value`; a plain string option is itself. What a filter
 * sends and what a select / radio / multiselect writes into the model.
 * Since 0.1.148; form options (`TFormEntryOptions`) since 0.1.165.
 */
export function optionValue(option: TFormEntryOptions): string | number | boolean {
  return typeof option === "string" ? option : (option.value ?? option.key);
}
