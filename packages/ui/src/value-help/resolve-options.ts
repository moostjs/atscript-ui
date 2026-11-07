import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import type { TFormEntryOptions } from "./types";
import { UI_FORM_FN_OPTIONS, UI_FORM_OPTIONS } from "../shared/annotation-keys";
import { resolveFieldProp, asArray } from "../shared/field-resolver";
import { extractFieldLiteralOptions, extractLiteralOptions } from "./extract-literals";
import type { UiT } from "../i18n/ui-texts";
import { userText, type UserTextT } from "../i18n/model-texts";

/** Extracts the key from an option entry. */
export function optKey(opt: TFormEntryOptions): string {
  return typeof opt === "string" ? opt : opt.key;
}

/** Extracts the display label from an option entry. */
export function optLabel(opt: TFormEntryOptions): string {
  return typeof opt === "string" ? opt : opt.label;
}

const labelMaps = new WeakMap<object, Map<string, string>>();

/**
 * The display label of a literal-union (or boolean) column's option (`@ui.literalLabel`) for
 * `value` — `undefined` when the column has no options or none matches. Map-backed
 * per options array, so rendering a table does not scan the options per cell.
 * The one lookup behind the table cell, the filter chips, export and a custom cell.
 * Since 0.1.148.
 */
export function optionLabel(
  column: { options?: { key: string; label: string }[] },
  value: unknown,
): string | undefined {
  const options = column.options;
  if (!options?.length) return undefined;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }
  let labels = labelMaps.get(options);
  if (!labels) {
    labels = new Map(options.map((o) => [o.key, o.label]));
    labelMaps.set(options, labels);
  }
  return labels.get(String(value));
}

/**
 * Converts raw option annotation value to a normalized array. `t` translates
 * the labels (never the keys: an option without a value is its own key).
 */
export function parseStaticOptions(raw: unknown, t?: UserTextT): TFormEntryOptions[] {
  const items = asArray(raw);
  return items.map((item) => {
    if (typeof item === "object" && item !== null && "label" in item) {
      const { label, value } = item as { label: string; value?: string };
      const shown = userText(UI_FORM_OPTIONS, { label }, t).label;
      if (value !== undefined) return { key: value, label: shown };
      return shown === label ? label : { key: label, label: shown };
    }
    return String(item);
  });
}

/**
 * Resolves options from metadata with a fallback chain:
 * 1. `@ui.form.fn.options` (dynamic, compiled by ui-fns)
 * 2. `@ui.form.options` (static annotation)
 * 3. Literal union / boolean extraction (auto-derived from type); `labelsFrom`
 *    (`FormFieldDef.labelsFrom`, since 0.1.165) adds an enclosing prop's labels
 * 4. Future: dictionary / value-help lookup
 *
 * `t` words the default boolean labels (`UI_YES` / `UI_NO`); the active UI
 * texts when omitted — a component passes its app's (`useAsLocale().t`).
 * `text` translates the labels the model declares (`@ui.form.options`,
 * `@ui.literalLabel`); a computed option list is the fn's own to translate.
 */
export function resolveOptions(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
  labelsFrom?: TAtscriptAnnotatedType,
  t?: UiT,
  text?: UserTextT,
): TFormEntryOptions[] | undefined {
  const resolved = resolveFieldProp<TFormEntryOptions[]>(
    prop,
    UI_FORM_FN_OPTIONS,
    UI_FORM_OPTIONS,
    scope,
    { transform: (raw) => parseStaticOptions(raw, text) },
  );
  if (resolved !== undefined) return resolved;
  return labelsFrom
    ? extractLiteralOptions(prop, labelsFrom, t, text)
    : extractFieldLiteralOptions(prop, t, text);
}
