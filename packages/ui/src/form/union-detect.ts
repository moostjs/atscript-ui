import { detectUnionVariant, getByPath } from "./path-utils";
import {
  isObjectField,
  isUnionField,
  type FormDef,
  type FormObjectFieldDef,
  type FormUnionFieldDef,
} from "./types";

// ── Union-variant change detection (framework-agnostic) ──────

/**
 * True when ANY union field in the form resolves to a DIFFERENT discriminated
 * variant between two wrapped data containers. A variant picker typically
 * detects its variant index once at setup and keys the variant subtree on it,
 * so a rebase that lands a different variant (via conflict OR an upstream-only
 * switch) needs a remount to re-detect. This walks union + nested-object fields
 * and compares `detectUnionVariant` at each union path.
 *
 * Scope note (pragmatic): walks standalone + nested-OBJECT union fields. Unions
 * nested INSIDE array items are not walked — an array renderer that keeps a
 * stable per-item key across in-place value mutations would not remount an
 * existing row's picker on an upstream-driven variant flip, but that collision
 * (a 3-way rebase landing a different union variant inside an unchanged array
 * row) is a rare edge. TODO: extend to array-item unions if a real consumer
 * hits a stuck picker inside an array row.
 */
export function unionVariantChanged(
  def: FormDef,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  return walkUnionFields(def.fields, "", before, after);
}

function walkUnionFields(
  fields: FormDef["fields"],
  prefix: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  for (const field of fields) {
    if (field.phantom) continue;
    const fullPath = field.path ? (prefix ? `${prefix}.${field.path}` : field.path) : prefix;

    if (isUnionField(field)) {
      const variants = (field as FormUnionFieldDef).unionVariants;
      if (variants.length > 1) {
        const bi = detectUnionVariant(getByPath(before, fullPath), variants);
        const ai = detectUnionVariant(getByPath(after, fullPath), variants);
        if (bi !== ai) return true;
      }
      continue;
    }

    if (isObjectField(field)) {
      const objectDef = (field as FormObjectFieldDef).objectDef;
      if (walkUnionFields(objectDef.fields, fullPath, before, after)) return true;
    }
  }
  return false;
}
