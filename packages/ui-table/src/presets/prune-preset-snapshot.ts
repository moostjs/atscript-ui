import type { SortControl } from "@atscript/ui";
import type { FilterExpr } from "@uniqu/core";
import type { FieldFilters } from "../filters/filter-types";
import { filterExprFields } from "../filters/uniquery-to-filters";
import type { PresetSnapshot } from "./preset-types";

/**
 * The field paths a table can use, derived from its column list. A path
 * outside these sets is one the server does not expose to the current caller
 * (hidden by role, removed from the schema) — naming it in a query is rejected.
 *
 * @since 0.1.141
 */
export interface KnownFields {
  /**
   * Every column path, client-owned (display) columns included, in column
   * order. Gates `columnNames`, column widths and sorters (a sorter on a
   * client-owned column is applied in memory).
   */
  columns: ReadonlySet<string>;
  /**
   * Server-backed column paths. Gates displayed filter inputs, field filters
   * and residual filter conditions.
   */
  server: ReadonlySet<string>;
}

/**
 * What pruning left out of a preset snapshot or of residual conditions
 * because it names a field outside {@link KnownFields}.
 *
 * @since 0.1.141
 */
export interface DroppedFields {
  /** The unavailable field paths behind the drops, deduped, in order of appearance. */
  fields: string[];
  /** Dropped `columnNames` entries. */
  columns: string[];
  /** Dropped displayed filter inputs. */
  filterFields: string[];
  /** Dropped field filters — whole entries, one per field. */
  filters: FieldFilters;
  /** Dropped filter conditions — each a whole AND-ed conjunct. */
  residual: FilterExpr[];
  /** Dropped sorters. */
  sorters: SortControl[];
}

/** `[kept, dropped]` in one pass. */
function partition<T>(list: readonly T[], keep: (x: T) => boolean): [T[], T[]] {
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const x of list) (keep(x) ? kept : dropped).push(x);
  return [kept, dropped];
}

/** The columns aspect, an empty width map spelled by omission — the way capture writes it. */
function columnsAspect(
  columnNames: string[],
  columnWidths: Record<string, string> | undefined,
): NonNullable<PresetSnapshot["columns"]> {
  return columnWidths && Object.keys(columnWidths).length > 0
    ? { columnNames, columnWidths }
    : { columnNames };
}

/**
 * Remove every entry of `snapshot` that names a field outside `known`, per
 * aspect:
 *
 * - `columns.columnNames` — unknown names go, the rest keep their order. When
 *   none survives, it falls back to every column, never an empty grid.
 * - `columns.columnWidths` — unknown keys go.
 * - `filters` (displayed inputs) and `filterOps` — entries on a field outside
 *   `known.server` go. A field's conditions are one AND-ed conjunct, so
 *   dropping one only broadens the result.
 * - `sorters` — unknown entries go, the rest keep their priority.
 * - `itemsPerPage` — untouched.
 *
 * `dropped` is `null` when nothing user-visible went (a width-only drop is
 * hygiene). The input is never mutated.
 *
 * @since 0.1.141
 */
export function prunePresetSnapshot(
  snapshot: PresetSnapshot,
  known: KnownFields,
): { snapshot: PresetSnapshot; dropped: DroppedFields | null } {
  const isColumn = (p: string) => known.columns.has(p);
  const isServer = (p: string) => known.server.has(p);
  const out: PresetSnapshot = { ...snapshot };
  const dropped: DroppedFields = {
    fields: [],
    columns: [],
    filterFields: [],
    filters: {},
    residual: [],
    sorters: [],
  };

  if (snapshot.columns) {
    const [names, gone] = partition(snapshot.columns.columnNames, isColumn);
    const [widths] = partition(Object.entries(snapshot.columns.columnWidths ?? {}), ([p]) =>
      isColumn(p),
    );
    dropped.columns = gone;
    // A grid with no columns renders nothing — show every column instead.
    const columnNames = names.length > 0 || gone.length === 0 ? names : [...known.columns];
    out.columns = columnsAspect(columnNames, Object.fromEntries(widths));
  }
  if (snapshot.filters) {
    [out.filters, dropped.filterFields] = partition(snapshot.filters, isServer);
  }
  if (snapshot.filterOps) {
    const [kept, gone] = partition(Object.entries(snapshot.filterOps), ([p]) => isServer(p));
    out.filterOps = Object.fromEntries(kept);
    dropped.filters = Object.fromEntries(gone);
  }
  if (snapshot.sorters) {
    [out.sorters, dropped.sorters] = partition(snapshot.sorters, (s) => isColumn(s.field));
  }

  dropped.fields = [
    ...new Set([
      ...dropped.columns,
      ...dropped.filterFields,
      ...Object.keys(dropped.filters),
      ...dropped.sorters.map((s) => s.field),
    ]),
  ];
  return { snapshot: out, dropped: dropped.fields.length > 0 ? dropped : null };
}

/**
 * Split residual filter conditions, in one pass, into the ones that name
 * only `known` fields and the ones that do not. A condition naming any
 * unknown field is dropped WHOLE — never pruned inside an `$or` (that would
 * narrow the result) or a `$not` (that would invert it). Each condition is an
 * AND-ed conjunct, so dropping one only broadens the result.
 *
 * `dropped` holds the conditions in `residual` and the unknown paths in
 * `fields`; `null` when every condition is kept.
 *
 * @since 0.1.141
 */
export function pruneResidualFilters(
  exprs: FilterExpr[],
  known: ReadonlySet<string>,
): { kept: FilterExpr[]; dropped: DroppedFields | null } {
  const kept: FilterExpr[] = [];
  const residual: FilterExpr[] = [];
  const fields = new Set<string>();
  for (const expr of exprs) {
    const unknown = filterExprFields(expr).filter((p) => !known.has(p));
    if (unknown.length === 0) {
      kept.push(expr);
      continue;
    }
    residual.push(expr);
    for (const p of unknown) fields.add(p);
  }
  if (residual.length === 0) return { kept, dropped: null };
  const dropped: DroppedFields = {
    fields: [...fields],
    columns: [],
    filterFields: [],
    filters: {},
    residual,
    sorters: [],
  };
  return { kept, dropped };
}

/**
 * Append what a prune dropped back onto a snapshot captured from (pruned)
 * table state, so overwriting a preset with a narrower view does not destroy
 * the parts the saver cannot see. Column names, filter inputs and sorters go
 * after the captured ones; field filters are added back. Only aspects
 * `captured` carries are touched; widths of hidden columns are not kept.
 *
 * @since 0.1.141
 */
export function restoreDroppedEntries(
  captured: PresetSnapshot,
  dropped: DroppedFields,
): PresetSnapshot {
  const out: PresetSnapshot = { ...captured };
  if (captured.columns) {
    out.columns = columnsAspect(
      [...captured.columns.columnNames, ...dropped.columns],
      captured.columns.columnWidths,
    );
  }
  if (captured.filters) out.filters = [...captured.filters, ...dropped.filterFields];
  if (captured.filterOps) out.filterOps = { ...captured.filterOps, ...dropped.filters };
  if (captured.sorters) out.sorters = [...captured.sorters, ...dropped.sorters];
  return out;
}
