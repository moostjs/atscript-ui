import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeFinal,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import { deserializeAnnotatedType, flattenAnnotatedType } from "@atscript/typescript/utils";
import type { TDbActionInfo } from "@atscript/db-client";
import { getFieldMeta } from "../shared/field-resolver";
import {
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_COLUMN_PRECISION,
  DB_JSON,
  DB_UNIT,
  DB_UNIT_REF,
  EXPECT_MAX_LENGTH,
  META_LABEL,
  UI_TABLE_COMPONENT,
  UI_TABLE_HIDDEN,
  UI_TABLE_ORDER,
  UI_TABLE_TYPE,
  UI_TABLE_WIDTH,
  UI_TYPE,
} from "../shared/annotation-keys";
import { extractLiteralOptions } from "../value-help/extract-literals";
import { extractValueHelp } from "../value-help/extract-ref";
import type { ColumnDef, MetaResponse, TableActionsModel, TableDef } from "./types";

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
    if (!(path in meta.fields)) {
      // Sub-paths become columns only when the server lists them in meta.fields —
      // keeps atomic JSON/document columns from leaking their internals as synthetic columns.
      // Top-level object/array parents that aren't in meta.fields are flat-flattened
      // structures (no `@db.json`) — their leaves are the real physical columns and
      // appear in meta.fields, so skip the synthetic parent here.
      const kind = prop.type.kind;
      if (path.includes(".") || kind === "object" || kind === "array") continue;
    }

    const fieldMeta = meta.fields[path];
    const options = extractLiteralOptions(prop);
    const valueHelpInfo = extractValueHelp(prop);

    const maxLengthMeta = getFieldMeta(prop, EXPECT_MAX_LENGTH) as
      | { length: number; message?: string }
      | undefined;

    const tableType = getFieldMeta(prop, UI_TABLE_TYPE) as string | undefined;
    const sharedType = getFieldMeta(prop, UI_TYPE) as string | undefined;
    const tableComponent = getFieldMeta(prop, UI_TABLE_COMPONENT) as string | undefined;
    const precisionMeta = getFieldMeta(prop, DB_COLUMN_PRECISION) as
      | { precision: number; scale: number }
      | undefined;

    // `@db.json` columns store an opaque JSON blob — the adapter contract
    // doesn't support filtering or sorting on the raw value, so force both
    // capabilities off regardless of what the server reported. Defensive:
    // moost-db currently emits `filterable: true` by default for every
    // non-ignored field (see atscript-db TODO.md).
    const isJsonColumn = getFieldMeta(prop, DB_JSON) === true;

    columns.push({
      path,
      label: (getFieldMeta(prop, META_LABEL) as string | undefined) ?? humanizePath(path),
      type: tableType ?? sharedType ?? (valueHelpInfo ? "ref" : inferDisplayType(prop, options)),
      component: tableComponent,
      sortable: isJsonColumn ? false : (fieldMeta?.sortable ?? false),
      filterable: isJsonColumn ? false : (fieldMeta?.filterable ?? false),
      visible: getFieldMeta(prop, UI_TABLE_HIDDEN) === undefined,
      width: getFieldMeta(prop, UI_TABLE_WIDTH) as string | undefined,
      maxLen: maxLengthMeta?.length,
      order: (getFieldMeta(prop, UI_TABLE_ORDER) as number | undefined) ?? Infinity,
      options,
      valueHelpInfo,
      currencyCode: getFieldMeta(prop, DB_AMOUNT_CURRENCY) as string | undefined,
      currencyRefField: getFieldMeta(prop, DB_AMOUNT_CURRENCY_REF) as string | undefined,
      unitCode: getFieldMeta(prop, DB_UNIT) as string | undefined,
      unitRefField: getFieldMeta(prop, DB_UNIT_REF) as string | undefined,
      precisionScale: precisionMeta?.scale,
    });
  }

  columns.sort((a, b) => a.order - b.order);

  const actions = groupActions(meta.actions ?? []);
  const crud = meta.crud ?? {};

  return {
    type,
    columns,
    flatMap,
    primaryKeys: meta.primaryKeys,
    // Older servers / stub fixtures may omit `preferredId` — fall back to PK
    // so identifier extraction and `$1` substitution stay defined.
    preferredId: meta.preferredId ?? meta.primaryKeys,
    crud,
    canRemove: "remove" in crud,
    actions,
    searchable: meta.searchable,
    vectorSearchable: meta.vectorSearchable,
    searchIndexes: meta.searchIndexes,
    relations: meta.relations,
  };
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
  if (kind === "union") return literalOpts !== undefined ? "enum" : "text";
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

/** Converts a dot-path to a human-readable label (e.g. 'firstName' → 'First Name'). */
function humanizePath(path: string): string {
  const last = path.slice(path.lastIndexOf(".") + 1);
  return last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
}
