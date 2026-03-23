import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeComplex,
  TAtscriptTypeFinal,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import { deserializeAnnotatedType, flattenAnnotatedType } from "@atscript/typescript/utils";
import { getFieldMeta } from "../shared/field-resolver";
import {
  META_LABEL,
  UI_HIDDEN,
  UI_ICON,
  UI_ORDER,
  UI_TYPE,
  UI_WIDTH,
} from "../shared/annotation-keys";
import type { ColumnDef, MetaResponse, TableDef } from "./types";

/**
 * Builds a TableDef from a moost-db MetaResponse.
 *
 * 1. Deserializes `meta.type` into a live TAtscriptAnnotatedType
 * 2. Flattens to discover all field paths
 * 3. Builds ColumnDef per field using annotations + meta.fields capabilities
 * 4. Sorts by @ui.order
 */
export function createTableDef(meta: MetaResponse): TableDef {
  const type = deserializeAnnotatedType(meta.type);

  // Only flatten if the root is an object type
  const flatMap =
    type.type.kind === "object"
      ? flattenAnnotatedType(type as TAtscriptAnnotatedType<TAtscriptTypeObject>, {
          excludePhantomTypes: true,
        })
      : new Map<string, TAtscriptAnnotatedType>();

  const columns: ColumnDef[] = [];

  for (const [path, prop] of flatMap.entries()) {
    if (path === "") continue;

    const fieldMeta = meta.fields[path];

    columns.push({
      path,
      label: (getFieldMeta(prop, META_LABEL) as string | undefined) ?? humanizePath(path),
      type: (getFieldMeta(prop, UI_TYPE) as string | undefined) ?? inferDisplayType(prop),
      sortable: fieldMeta?.sortable ?? false,
      filterable: fieldMeta?.filterable ?? false,
      visible: getFieldMeta(prop, UI_HIDDEN) === undefined,
      width: getFieldMeta(prop, UI_WIDTH) as string | undefined,
      order: (getFieldMeta(prop, UI_ORDER) as number | undefined) ?? Infinity,
      icon: getFieldMeta(prop, UI_ICON) as string | undefined,
      options: extractUnionOptions(prop),
    });
  }

  columns.sort((a, b) => a.order - b.order);

  return {
    type,
    columns,
    primaryKeys: meta.primaryKeys,
    readOnly: meta.readOnly,
    searchable: meta.searchable,
    vectorSearchable: meta.vectorSearchable,
    searchIndexes: meta.searchIndexes,
    relations: meta.relations,
  };
}

/** Infers a display type string from the annotated type's kind and designType. */
function inferDisplayType(prop: TAtscriptAnnotatedType): string {
  const kind = prop.type.kind;
  if (kind === "array") return "array";
  if (kind === "object") return "object";
  if (kind === "union") {
    const literals = collectLiterals((prop.type as TAtscriptTypeComplex).items, new Set());
    if (literals !== null && literals.length > 0) return "enum";
    return "text";
  }
  if (kind === "") {
    const dt = (prop.type as TAtscriptTypeFinal).designType;
    if (dt === "number" || dt === "decimal") return "number";
    if (dt === "boolean") return "boolean";
    return "text";
  }
  return "text";
}

/**
 * Extracts options from a union of literal types (e.g. 'a' | 'b' | 'c').
 * Returns undefined if the type is not a pure union of literals.
 *
 * Handles nested unions created by flattenAnnotatedType, which recurses
 * into union items and produces synthetic unions containing both individual
 * literals and the original union type as nested items.
 */
function extractUnionOptions(
  prop: TAtscriptAnnotatedType,
): { key: string; label: string }[] | undefined {
  if (prop.type.kind !== "union") return undefined;
  const result = collectLiterals((prop.type as TAtscriptTypeComplex).items, new Set());
  return result && result.length > 0 ? result : undefined;
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

/** Converts a dot-path to a human-readable label (e.g. 'firstName' → 'First Name'). */
function humanizePath(path: string): string {
  const last = path.slice(path.lastIndexOf(".") + 1);
  return last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
}
