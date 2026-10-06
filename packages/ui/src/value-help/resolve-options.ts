import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import type { TFormEntryOptions } from "./types";
import { UI_FORM_FN_OPTIONS, UI_FORM_OPTIONS } from "../shared/annotation-keys";
import { resolveFieldProp, asArray } from "../shared/field-resolver";
import { extractFieldLiteralOptions } from "./extract-literals";

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
 * The display label of a literal-union column's option (`@ui.literalLabel`) for
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
 * Converts raw option annotation value to a normalized array.
 */
export function parseStaticOptions(raw: unknown): TFormEntryOptions[] {
  const items = asArray(raw);
  return items.map((item) => {
    if (typeof item === "object" && item !== null && "label" in item) {
      const { label, value } = item as { label: string; value?: string };
      return value !== undefined ? { key: value, label } : label;
    }
    return String(item);
  });
}

/**
 * Resolves options from metadata with a fallback chain:
 * 1. `@ui.form.fn.options` (dynamic, compiled by ui-fns)
 * 2. `@ui.form.options` (static annotation)
 * 3. Literal union type extraction (auto-derived from type)
 * 4. Future: dictionary / value-help lookup
 */
export function resolveOptions(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
): TFormEntryOptions[] | undefined {
  const resolved = resolveFieldProp<TFormEntryOptions[]>(
    prop,
    UI_FORM_FN_OPTIONS,
    UI_FORM_OPTIONS,
    scope,
    { transform: parseStaticOptions },
  );
  if (resolved !== undefined) return resolved;
  return extractFieldLiteralOptions(prop);
}
