import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { UI_VALUE_LABEL } from "./annotation-keys";
import { getFieldMeta } from "./field-resolver";

/**
 * How `@ui.valueLabel` shows a code with its text (since 0.1.190):
 * `textKey` — `Berlin (BER)`, `keyText` — `BER (Berlin)`, `text` — `Berlin`.
 */
export type ValueLabelArrangement = "textKey" | "keyText" | "text";

/** `@ui.valueLabel` of a field: the sibling holding the text, and the arrangement. Since 0.1.190. */
export interface ValueLabel {
  /** The sibling field holding the text (a name, relative to the field's parent). */
  field: string;
  arrangement: ValueLabelArrangement;
}

/** The field's `@ui.valueLabel`, the arrangement defaulted to `textKey`; `undefined` without one. */
export function valueLabelOf(prop: TAtscriptAnnotatedType): ValueLabel | undefined {
  const meta = getFieldMeta(prop, UI_VALUE_LABEL) as
    | { field: string; arrangement?: ValueLabelArrangement }
    | undefined;
  if (!meta?.field) return undefined;
  return { field: meta.field, arrangement: meta.arrangement ?? "textKey" };
}

/**
 * The one rendering of a code with its text (`@ui.valueLabel`, since 0.1.190):
 * `textKey` (default) `text (key)`, `keyText` `key (text)`, `text` the text
 * alone. An empty text (`undefined`, `null`, `""`, or no scalar) yields the
 * key; an empty key yields `""` — a text without a code labels nothing.
 */
export function arrangeText(
  key: string,
  text: unknown,
  arrangement: ValueLabelArrangement = "textKey",
): string {
  if (key === "") return "";
  const label =
    typeof text === "string" ? text : typeof text === "number" ? String(text) : undefined;
  if (!label) return key;
  if (arrangement === "text") return label;
  return arrangement === "keyText" ? `${key} (${label})` : `${label} (${key})`;
}
