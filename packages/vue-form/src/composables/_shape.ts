import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

/**
 * Match the input shape on commit: `null`/`undefined` model → write the
 * canonical string (first-ever commit); pre-existing string → string;
 * pre-existing number → number (caller opted into float; the precision
 * loss is on them).
 *
 * Shared by `useAsDecimal` and `useAsNumber`. Not exported from the
 * package barrel — internal helper, no public surface.
 */
export function preserveShape(
  original: string | number | null | undefined,
  normalized: string,
): string | number {
  if (original === null || original === undefined) return normalized;
  if (typeof original === "string") return normalized;
  return Number(normalized);
}

/**
 * The value an emptied input commits: `undefined` (omitted) on an optional
 * field — `null` is not a value of `name?: T`, and atscript >= 0.1.103
 * rejects it there when the field also carries `@meta.required` — else
 * `null`. Shared by the number / decimal / date / datetime / time inputs and
 * the native number input of the text control.
 */
export function committedValue<T>(
  value: T | null,
  optional: boolean | undefined,
): T | null | undefined {
  return value === null && optional ? undefined : value;
}

/**
 * The value an emptied text input commits: `undefined` (omitted) on an
 * optional field, like {@link committedValue}; `""` on a required one. Used by
 * the text control (which also renders the reference input's plain-text
 * fallback).
 */
export function committedText(value: unknown, optional: boolean | undefined): unknown {
  return value === "" && optional ? undefined : value;
}

/**
 * The value an emptied reference commits — the picker's "×" and the empty
 * option of a dropdown bound to a dictionary: `undefined` on an optional
 * field; else `""` for a string key and `null` for any other (a number id).
 */
export function emptiedKey(
  type: TAtscriptAnnotatedType["type"] | undefined,
  optional: boolean | undefined,
): unknown {
  const stringKey = type?.kind === "" && type.designType === "string";
  return stringKey ? committedText("", optional) : committedValue(null, optional);
}

/**
 * The one loaded row holding `value` in `field` — `undefined` when none does or
 * when several do (a dictionary whose key has more members than the committed
 * field): the value is then committed without a row, so no fill guesses one.
 */
export function soleRow(
  rows: readonly Record<string, unknown>[],
  field: string,
  value: unknown,
): Record<string, unknown> | undefined {
  let found: Record<string, unknown> | undefined;
  for (const row of rows) {
    if (row[field] !== value) continue;
    if (found) return undefined;
    found = row;
  }
  return found;
}
