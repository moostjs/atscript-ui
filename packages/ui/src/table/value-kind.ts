import type { ColumnDef, ColumnValueKind } from "./types";

/** Storage kinds that hold plain numbers (a `timestamp` is epoch ms, but filters treat it as a date). */
export const NUMERIC_VALUE_KINDS: ReadonlySet<ColumnValueKind> = new Set<ColumnValueKind>([
  "number",
  "integer",
  "decimal",
]);

/**
 * The typed value of one of a column's `options` — the literal itself
 * (`true`, `3`, `'a'`), falling back to the string `key` for a hand-built
 * column that has no `value`.
 *
 * @internal Shared with `@atscript/vue-table`.
 */
export function optionValue(
  option: NonNullable<ColumnDef["options"]>[number],
): string | number | boolean {
  return option.value ?? option.key;
}
