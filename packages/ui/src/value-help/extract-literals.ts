import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeArray,
  TAtscriptTypeComplex,
  TAtscriptTypeFinal,
} from "@atscript/typescript/utils";
import { UI_LITERAL_LABEL } from "../shared/annotation-keys";
import { getUiTexts, type UiT } from "../i18n/ui-texts";
import { AS_UI_MESSAGES } from "../messages";

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
 * The English labels an unlabelled `boolean` value shows — in table cells,
 * filter chips, the filter picker, export and read-only form fields. They are
 * the UI texts `UI_YES` / `UI_NO` (`AS_UI_MESSAGES`), shown in the UI locale.
 * Since 0.1.165.
 */
export const DEFAULT_BOOLEAN_LABELS: Readonly<Record<"true" | "false", string>> = Object.freeze({
  true: AS_UI_MESSAGES.UI_YES,
  false: AS_UI_MESSAGES.UI_NO,
});

/**
 * Extracts options from a union of literal types (e.g. 'a' | 'b' | 'c') or a
 * `boolean` (since 0.1.165: the two values `true` / `false`, labelled
 * {@link DEFAULT_BOOLEAN_LABELS} unless `@ui.literalLabel` says otherwise).
 * `null` / `undefined` members of a union (`'a' | 'b' | null`, `boolean | null`)
 * are not values and are skipped. Returns undefined for anything else.
 *
 * Handles nested unions created by flattenAnnotatedType, which recurses
 * into union items and produces synthetic unions containing both individual
 * literals and the original union type as nested items.
 */
export function extractLiteralOptions(
  prop: TAtscriptAnnotatedType,
  outer?: TAtscriptAnnotatedType,
  t: UiT = getUiTexts().t,
): LiteralOption[] | undefined {
  const items =
    prop.type.kind === "union"
      ? (prop.type as TAtscriptTypeComplex).items
      : isBooleanPrimitive(prop)
        ? [prop]
        : undefined;
  const result = items && collectLiterals(items, new Set(), t);
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
 * The literal options of a field: a literal union's or a boolean's (since 0.1.165),
 * or those of an array of one (`tags: Tag[]`, `flags: boolean[]`), where the array
 * prop's own `@ui.literalLabel` labels win over the element type's. `undefined` when
 * the field is neither. Since 0.1.148.
 */
export function extractFieldLiteralOptions(
  prop: TAtscriptAnnotatedType,
  t: UiT = getUiTexts().t,
): LiteralOption[] | undefined {
  if (prop.type.kind === "array") {
    return extractLiteralOptions((prop.type as TAtscriptTypeArray).of, prop, t);
  }
  return extractLiteralOptions(prop, undefined, t);
}

/** A `null` / `undefined` member of a union (`T | null`): no value of its own. */
export function isEmptyMember(item: TAtscriptAnnotatedType): boolean {
  const dt = (item.type as TAtscriptTypeFinal).designType;
  return item.type.kind === "" && (dt === "null" || dt === "undefined");
}

/** A `boolean` (not a `true` / `false` literal). */
function isBooleanPrimitive(prop: TAtscriptAnnotatedType): boolean {
  const final = prop.type as TAtscriptTypeFinal;
  return prop.type.kind === "" && final.designType === "boolean" && final.value === undefined;
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
 * Recursively collects literal values from union items: a literal is one value
 * (a `true` / `false` literal default-labelled like a boolean's), a `boolean` the
 * two (`true` / `false`, default-labelled), a `null` / `undefined`
 * member none. Returns null if any other item is found (no options).
 * Returns empty array when all items are valid but already seen (deduped).
 */
function collectLiterals(
  items: TAtscriptAnnotatedType[],
  seen: Set<string>,
  t: UiT,
): LiteralOption[] | null {
  const result: LiteralOption[] = [];
  const add = (raw: string | number | boolean) => {
    const val = String(raw);
    if (!seen.has(val)) {
      seen.add(val);
      // a `true` / `false` literal reads like a boolean's value
      const label = typeof raw === "boolean" ? t(raw ? "UI_YES" : "UI_NO") : val;
      result.push({ key: val, label, value: raw });
    }
  };
  for (const item of items) {
    const final = item.type as TAtscriptTypeFinal;
    if (item.type.kind === "" && final.value !== undefined) {
      add(final.value as string | number | boolean);
    } else if (isBooleanPrimitive(item)) {
      add(true);
      add(false);
    } else if (isEmptyMember(item)) {
      continue;
    } else if (item.type.kind === "union") {
      const nested = collectLiterals((item.type as TAtscriptTypeComplex).items, seen, t);
      if (nested === null) return null;
      result.push(...nested);
    } else {
      return null;
    }
  }
  return result;
}
