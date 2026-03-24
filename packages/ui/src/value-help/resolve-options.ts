import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import type { TFormEntryOptions } from "./types";
import { UI_FN_OPTIONS, UI_OPTIONS } from "../shared/annotation-keys";
import { resolveFieldProp, asArray } from "../shared/field-resolver";
import { extractLiteralOptions } from "./extract-literals";

/** Extracts the key from an option entry. */
export function optKey(opt: TFormEntryOptions): string {
  return typeof opt === "string" ? opt : opt.key;
}

/** Extracts the display label from an option entry. */
export function optLabel(opt: TFormEntryOptions): string {
  return typeof opt === "string" ? opt : opt.label;
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
 * 1. `@ui.fn.options` (dynamic, compiled by ui-fns)
 * 2. `@ui.options` (static annotation)
 * 3. Literal union type extraction (auto-derived from type)
 * 4. Future: dictionary / value-help lookup
 */
export function resolveOptions(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
): TFormEntryOptions[] | undefined {
  const resolved = resolveFieldProp<TFormEntryOptions[]>(prop, UI_FN_OPTIONS, UI_OPTIONS, scope, {
    transform: parseStaticOptions,
  });
  if (resolved !== undefined) return resolved;
  return extractLiteralOptions(prop);
}
