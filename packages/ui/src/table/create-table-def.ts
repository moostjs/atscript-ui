import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeComplex,
  TAtscriptTypeFinal,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import { deserializeAnnotatedType, flattenAnnotatedType } from "@atscript/typescript/utils";
import type { TDbActionInfo } from "@atscript/db-client";
import { getFieldMeta } from "../shared/field-resolver";
import {
  DB_HTTP_PATH,
  EXPECT_MAX_LENGTH,
  META_LABEL,
  UI_TABLE_COMPONENT,
  UI_TABLE_EXCLUDE,
  UI_TABLE_ORDER,
  UI_TABLE_SELECT_WITH,
  UI_TABLE_TYPE,
  UI_TABLE_WIDTH,
  UI_TYPE,
  UI_VALUE_HELP_DISTINCT,
} from "../shared/annotation-keys";
import { extractMeasurement } from "../form/measurement";
import { humanizePath } from "../shared/str";
import { extractFieldLiteralOptions, type LiteralOption } from "../value-help/extract-literals";
import { extractValueHelp } from "../value-help/extract-ref";
import type { ValueHelpInfo } from "../value-help/types";
import type {
  ColumnDef,
  ColumnValueKind,
  FieldMeta,
  MetaResponse,
  TableActionsModel,
  TableDef,
} from "./types";

/**
 * Builds a TableDef from a moost-db MetaResponse.
 *
 * 1. Deserializes `meta.type` into a live TAtscriptAnnotatedType
 * 2. Flattens to discover all field paths
 * 3. Builds ColumnDef per field using annotations + meta.fields capabilities
 * 4. Sorts by @ui.table.order
 */
export function createTableDef(
  meta: MetaResponse,
  preDeserializedType?: TAtscriptAnnotatedType,
): TableDef {
  const type = preDeserializedType ?? deserializeAnnotatedType(meta.type);

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
    if (path === meta.versionColumn) continue;
    // Only readable fields become columns: the server lists them in meta.fields
    // and does not mark them `writeOnly`. Anything else would be rejected in
    // `$select` / filters / `$sort`. The gate also keeps atomic JSON/document
    // columns from leaking their internals as synthetic sub-path columns, and
    // skips flat-flattened object parents (no `@db.json`), whose leaves are the
    // real physical columns listed in meta.fields.
    const fieldMeta = meta.fields[path];
    if (!isReadable(fieldMeta)) continue;

    // `@ui.table.exclude` fields never become columns (not displayable,
    // filterable, sortable, or shown in the config dialog). They stay in
    // `fetchableFields` below so they remain valid `@ui.table.selectWith` targets.
    if (getFieldMeta(prop, UI_TABLE_EXCLUDE) !== undefined) continue;

    const options = extractFieldLiteralOptions(prop);
    const valueHelpInfo = extractValueHelp(prop);
    let distinct: ColumnDef["distinct"];
    if (!valueHelpInfo && !options && fieldMeta.groupable && fieldMeta.filterable) {
      // Distinct-values picker: opt-in per field, served by this table's own controller.
      const url = type.metadata.get(DB_HTTP_PATH) as string | undefined;
      if (url && getFieldMeta(prop, UI_VALUE_HELP_DISTINCT) !== undefined) {
        distinct = { url, field: path };
      }
    }

    columns.push(buildColumn(path, prop, fieldMeta, { options, valueHelpInfo, distinct }));
  }

  // Server-declared display-only columns (`@DbDecorations`): top-level props of
  // `meta.decorations` the server lists in `meta.fields` with `decoration: true`.
  // Not sortable, not filterable, no value help; absent on older servers.
  if (meta.decorations) {
    const decoType = deserializeAnnotatedType(meta.decorations);
    if (decoType.type.kind === "object") {
      for (const [path, prop] of (decoType as TAtscriptAnnotatedType<TAtscriptTypeObject>).type
        .props) {
        const fieldMeta = meta.fields[path];
        if (!fieldMeta?.decoration || flatMap.has(path)) continue;
        if (getFieldMeta(prop, UI_TABLE_EXCLUDE) !== undefined) continue;
        flatMap.set(path, prop);
        columns.push(
          buildColumn(path, prop, fieldMeta, { options: extractFieldLiteralOptions(prop) }),
        );
      }
    }
  }

  columns.sort((a, b) => a.order - b.order);

  const actions = groupActions(meta.actions ?? []);
  const crud = meta.crud ?? {};
  // Older servers / stub fixtures may omit `preferredId` — fall back to PK
  // so identifier extraction and `$1` substitution stay defined.
  const preferredId = meta.preferredId ?? meta.primaryKeys;

  return {
    type,
    columns,
    flatMap,
    fetchableFields: new Set(Object.keys(meta.fields).filter((p) => isReadable(meta.fields[p]))),
    primaryKeys: meta.primaryKeys,
    preferredId,
    identifierFields: identifierFieldsOf(preferredId, meta.actions ?? []),
    versionColumn: meta.versionColumn,
    crud,
    canRemove: "remove" in crud,
    actions,
    searchable: meta.searchable,
    vectorSearchable: meta.vectorSearchable,
    searchIndexes: meta.searchIndexes,
    relations: meta.relations,
  };
}

/**
 * One column. A server-declared display-only column (`fieldMeta.decoration`)
 * is never sortable, filterable or groupable and always nullable (a decoration
 * can be absent); an ordinary one takes its capabilities from `/meta`.
 */
function buildColumn(
  path: string,
  prop: TAtscriptAnnotatedType,
  fieldMeta: FieldMeta,
  resolved: {
    options?: LiteralOption[];
    valueHelpInfo?: ValueHelpInfo;
    distinct?: ColumnDef["distinct"];
  },
): ColumnDef {
  const { options, valueHelpInfo, distinct } = resolved;
  const maxLengthMeta = getFieldMeta(prop, EXPECT_MAX_LENGTH) as
    | { length: number; message?: string }
    | undefined;
  const tableType = getFieldMeta(prop, UI_TABLE_TYPE) as string | undefined;
  const sharedType = getFieldMeta(prop, UI_TYPE) as string | undefined;
  const tableComponent = getFieldMeta(prop, UI_TABLE_COMPONENT) as string | undefined;
  const decoration = fieldMeta.decoration === true;
  const filterOps = decoration ? undefined : fieldMeta.filterOps;
  return {
    path,
    label: (getFieldMeta(prop, META_LABEL) as string | undefined) ?? humanizePath(path),
    type: tableType ?? sharedType ?? (valueHelpInfo ? "ref" : inferDisplayType(prop, options)),
    valueKind: inferValueKind(prop),
    component: tableComponent,
    selectWith: getFieldMeta(prop, UI_TABLE_SELECT_WITH) as string[] | undefined,
    sortable: !decoration && (fieldMeta.sortable ?? false),
    filterable: !decoration && (fieldMeta.filterable ?? false),
    ...(filterOps && { filterOps: [...filterOps] }),
    nullable: decoration || prop.optional === true,
    width: getFieldMeta(prop, UI_TABLE_WIDTH) as string | undefined,
    maxLen: maxLengthMeta?.length,
    order: (getFieldMeta(prop, UI_TABLE_ORDER) as number | undefined) ?? Infinity,
    options,
    valueHelpInfo,
    ...(distinct && { distinct }),
    ...extractMeasurement(prop),
  };
}

/**
 * `preferredId` ∪ every delegated action's `idMap` paths, in that order —
 * the same array when no action carries an `idMap`.
 */
function identifierFieldsOf(preferredId: string[], actions: TDbActionInfo[]): string[] {
  let out: string[] | undefined;
  for (const a of actions) {
    if (!a.idMap) continue;
    for (const path of Object.values(a.idMap)) {
      if (preferredId.includes(path) || out?.includes(path)) continue;
      (out ??= [...preferredId]).push(path);
    }
  }
  return out ?? preferredId;
}

/** A field the caller may read: listed in `meta.fields` and not write-only. */
function isReadable(field: FieldMeta | undefined): field is FieldMeta {
  return field !== undefined && field.writeOnly !== true;
}

/** Sort by (order ?? 0). `toSorted` is stable per spec, so ties preserve declaration order. */
function byOrder(xs: TDbActionInfo[]): TDbActionInfo[] {
  return xs.toSorted((x, y) => (x.order ?? 0) - (y.order ?? 0));
}

/**
 * Partition actions by `level`, sort each group by `(order ?? 0)` then
 * declaration order, and pick the first `default: true` entry per level.
 * The synthesised `__remove` UI action lives outside this set and is never
 * a candidate for `default.row`.
 */
function groupActions(actions: TDbActionInfo[]): TableActionsModel {
  const table: TDbActionInfo[] = [];
  const row: TDbActionInfo[] = [];
  const rows: TDbActionInfo[] = [];

  for (const a of actions) {
    if (a.level === "table") table.push(a);
    else if (a.level === "row") row.push(a);
    else if (a.level === "rows") rows.push(a);
  }

  const tableSorted = byOrder(table);
  const rowSorted = byOrder(row);
  const rowsSorted = byOrder(rows);

  return {
    table: tableSorted,
    row: rowSorted,
    rows: rowsSorted,
    default: {
      table: tableSorted.find((a) => a.default === true),
      row: rowSorted.find((a) => a.default === true),
      rows: rowsSorted.find((a) => a.default === true),
    },
  };
}

/** Infers a display type string from the annotated type's kind and designType. */
function inferDisplayType(prop: TAtscriptAnnotatedType, literalOpts?: unknown): string {
  const kind = prop.type.kind;
  if (kind === "array") return "array";
  if (kind === "object") return "object";
  if (kind === "union") return literalOpts !== undefined ? "enum" : "union";
  if (kind === "") {
    const final = prop.type as TAtscriptTypeFinal;
    const dt = final.designType;
    if (dt === "number") {
      // `number.timestamp` (wire-tagged `timestamp`) epoch-ms primitive →
      // render as datetime out of the box. Plain numbers stay numeric.
      return final.tags?.has("timestamp") ? "datetime" : "number";
    }
    if (dt === "decimal") return "number";
    if (dt === "boolean") return "boolean";
    return "text";
  }
  return "text";
}

/**
 * Number metadata that makes the server treat a plain `number` column as an
 * integer (mirrors the db layer's `valueTypeOf`), beside the `int` / `expect.int` tags.
 */
const INTEGER_NUMBER_META = [
  "expect.int",
  "db.default.increment",
  "db.default.now",
  "db.agg.count",
  "db.agg.countDistinct",
] as const;

/** The kind of one scalar leaf, or `undefined` for a non-scalar / unknown design type. */
function scalarValueKind(prop: TAtscriptAnnotatedType): ColumnValueKind | undefined {
  const final = prop.type as TAtscriptTypeFinal;
  const tags = final.tags;
  switch (final.designType) {
    case "string":
      return tags?.has("isoDate") ? "isoDate" : tags?.has("date") ? "date" : "string";
    case "number":
      if (tags?.has("timestamp")) return "timestamp";
      if (tags?.has("int") || INTEGER_NUMBER_META.some((k) => prop.metadata.has(k as never))) {
        return "integer";
      }
      return "number";
    case "decimal":
      return "decimal";
    case "boolean":
      return "boolean";
    default:
      return undefined;
  }
}

/** Kinds of every non-null leaf of a (possibly nested) union; `null` when one is not a scalar. */
function collectUnionKinds(
  items: TAtscriptAnnotatedType[],
  out: Set<ColumnValueKind | undefined>,
): void {
  for (const item of items) {
    if (item.type.kind === "union") {
      collectUnionKinds((item.type as TAtscriptTypeComplex).items, out);
      continue;
    }
    if (item.type.kind === "") {
      const dt = (item.type as TAtscriptTypeFinal).designType;
      if (dt === "null" || dt === "undefined") continue;
      out.add(scalarValueKind(item));
      continue;
    }
    out.add(undefined);
  }
}

/**
 * Scalar storage kind of the column's value — what the server's filter guard
 * checks. A scalar maps to its kind; a union that agrees on one kind across
 * its non-null members (`'a' | 'b'`, `1 | 2`, `number.timestamp | null`)
 * takes it; arrays, objects, JSON and mixed unions have none (`undefined`),
 * which means no value coercion.
 */
function inferValueKind(prop: TAtscriptAnnotatedType): ColumnValueKind | undefined {
  const kind = prop.type.kind;
  if (kind === "") return scalarValueKind(prop);
  if (kind !== "union") return undefined;
  const kinds = new Set<ColumnValueKind | undefined>();
  collectUnionKinds((prop.type as TAtscriptTypeComplex).items, kinds);
  if (kinds.size !== 1) return undefined;
  return [...kinds][0];
}
