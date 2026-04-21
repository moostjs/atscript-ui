import type {
  TAtscriptAnnotatedType,
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
import { extractLiteralOptions } from "../value-help/extract-literals";
import { extractValueHelp } from "../value-help/extract-ref";
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
    // Sub-paths become columns only when the server lists them in meta.fields —
    // keeps atomic JSON/document columns from leaking their internals as synthetic columns.
    if (path.includes(".") && !(path in meta.fields)) continue;

    const fieldMeta = meta.fields[path];
    const options = extractLiteralOptions(prop);
    const valueHelpInfo = extractValueHelp(prop);

    columns.push({
      path,
      label: (getFieldMeta(prop, META_LABEL) as string | undefined) ?? humanizePath(path),
      type:
        (getFieldMeta(prop, UI_TYPE) as string | undefined) ??
        (valueHelpInfo ? "ref" : inferDisplayType(prop, options)),
      sortable: fieldMeta?.sortable ?? false,
      filterable: fieldMeta?.filterable ?? false,
      visible: getFieldMeta(prop, UI_HIDDEN) === undefined,
      width: getFieldMeta(prop, UI_WIDTH) as string | undefined,
      order: (getFieldMeta(prop, UI_ORDER) as number | undefined) ?? Infinity,
      icon: getFieldMeta(prop, UI_ICON) as string | undefined,
      options,
      valueHelpInfo,
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
function inferDisplayType(prop: TAtscriptAnnotatedType, literalOpts?: unknown): string {
  const kind = prop.type.kind;
  if (kind === "array") return "array";
  if (kind === "object") return "object";
  if (kind === "union") return literalOpts !== undefined ? "enum" : "text";
  if (kind === "") {
    const dt = (prop.type as TAtscriptTypeFinal).designType;
    if (dt === "number" || dt === "decimal") return "number";
    if (dt === "boolean") return "boolean";
    return "text";
  }
  return "text";
}

/** Converts a dot-path to a human-readable label (e.g. 'firstName' → 'First Name'). */
function humanizePath(path: string): string {
  const last = path.slice(path.lastIndexOf(".") + 1);
  return last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
}
