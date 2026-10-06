import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeArray,
  TAtscriptTypeComplex,
  TAtscriptTypeFinal,
} from "@atscript/typescript/utils";
import { UI_LITERAL_LABEL } from "../shared/annotation-keys";

/**
 * One literal of a union: `key` / `label` are the string forms the UI keys
 * on; `value` is the typed literal (`true`, `3`, `'a'`) — what a filter or a
 * form must send to the server. `value` since 0.1.148.
 */
export interface LiteralOption {
  key: string;
  label: string;
  value: string | number | boolean;
}

/**
 * Extracts options from a union of literal types (e.g. 'a' | 'b' | 'c').
 * Returns undefined if the type is not a pure union of literals.
 *
 * Handles nested unions created by flattenAnnotatedType, which recurses
 * into union items and produces synthetic unions containing both individual
 * literals and the original union type as nested items.
 */
export function extractLiteralOptions(
  prop: TAtscriptAnnotatedType,
  outer?: TAtscriptAnnotatedType,
): LiteralOption[] | undefined {
  if (prop.type.kind !== "union") return undefined;
  const result = collectLiterals((prop.type as TAtscriptTypeComplex).items, new Set());
  if (!result || result.length === 0) return undefined;
  // `@ui.literalLabel` (since 0.1.148): a label per literal, raw text otherwise.
  // `mergeStrategy: "append"` lists the referenced type's labels first, then the prop's own,
  // so the later entry of a Map wins: for the same literal the prop's label overrides the type's.
  // `outer` is the array prop whose element type this is (`tags: Tag[]`): its own labels
  // are the prop's and win over the element type's.
  const labels = [prop, outer].flatMap(
    (node) =>
      (node?.metadata.get(UI_LITERAL_LABEL) as { value: string; label: string }[] | undefined) ??
      [],
  );
  if (labels.length) {
    const byValue = new Map(labels.map((l) => [l.value, l.label]));
    for (const option of result) option.label = byValue.get(option.key) ?? option.label;
  }
  return result;
}

/**
 * The literal options of a field: a literal union's, or those of an array of one
 * (`tags: Tag[]`), where the array prop's own `@ui.literalLabel` labels win over the
 * element type's. `undefined` when the field is neither. Since 0.1.148.
 */
export function extractFieldLiteralOptions(
  prop: TAtscriptAnnotatedType,
): LiteralOption[] | undefined {
  if (prop.type.kind === "array") {
    return extractLiteralOptions((prop.type as TAtscriptTypeArray).of, prop);
  }
  return extractLiteralOptions(prop);
}

/** Returns true when the annotated type is a union composed entirely of literal values. */
export function isPureLiteralUnion(prop: TAtscriptAnnotatedType): boolean {
  if (prop.type.kind !== "union") return false;
  return checkAllLiterals((prop.type as TAtscriptTypeComplex).items);
}

/** Walks union items returning true only if every leaf is a literal value. */
function checkAllLiterals(items: TAtscriptAnnotatedType[]): boolean {
  for (const item of items) {
    if (item.type.kind === "" && (item.type as TAtscriptTypeFinal).value !== undefined) continue;
    if (item.type.kind === "union") {
      if (!checkAllLiterals((item.type as TAtscriptTypeComplex).items)) return false;
      continue;
    }
    return false;
  }
  return items.length > 0;
}

/**
 * Recursively collects literal values from union items.
 * Returns null if any non-literal, non-union item is found (invalid union).
 * Returns empty array when all items are valid but already seen (deduped).
 */
function collectLiterals(
  items: TAtscriptAnnotatedType[],
  seen: Set<string>,
): LiteralOption[] | null {
  const result: LiteralOption[] = [];
  for (const item of items) {
    if (item.type.kind === "" && (item.type as TAtscriptTypeFinal).value !== undefined) {
      const raw = (item.type as TAtscriptTypeFinal).value as string | number | boolean;
      const val = String(raw);
      if (!seen.has(val)) {
        seen.add(val);
        result.push({ key: val, label: val, value: raw });
      }
    } else if (item.type.kind === "union") {
      const nested = collectLiterals((item.type as TAtscriptTypeComplex).items, seen);
      if (nested === null) return null;
      result.push(...nested);
    } else {
      return null;
    }
  }
  return result;
}
