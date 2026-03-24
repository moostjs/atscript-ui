import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeComplex,
  TAtscriptTypeFinal,
} from "@atscript/typescript/utils";

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
): { key: string; label: string }[] | undefined {
  if (prop.type.kind !== "union") return undefined;
  const result = collectLiterals((prop.type as TAtscriptTypeComplex).items, new Set());
  return result && result.length > 0 ? result : undefined;
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
): { key: string; label: string }[] | null {
  const result: { key: string; label: string }[] = [];
  for (const item of items) {
    if (item.type.kind === "" && (item.type as TAtscriptTypeFinal).value !== undefined) {
      const val = String((item.type as TAtscriptTypeFinal).value);
      if (!seen.has(val)) {
        seen.add(val);
        result.push({ key: val, label: val });
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
