import type { ColumnDef } from "@atscript/ui";

/**
 * A client-owned column the app adds on top of the server's `/meta` columns —
 * a derived value, a count, a link, a widget. It has a label, a width and a
 * renderer, takes part in column visibility / reordering / presets like any
 * other column, but never reaches the backend: no `$select`, no server sort,
 * no filters.
 *
 * Since 0.1.134.
 */
export interface DisplayColumnDef {
  /**
   * Stable key. Becomes the column's `path`, so it is what `cell-<key>` /
   * `header-<key>` slots, the `columnNames` model and presets refer to. Must
   * not collide with a real field path.
   */
  key: string;
  /** Header label. Unlike `fixed` chrome columns, a display column is labelled. */
  label: string;
  /** Default width (any CSS length), e.g. `"8em"`. */
  width?: string;
  /** Initial position among the server columns (lower = earlier). Appended when omitted. */
  order?: number;
  /**
   * `'local'` makes the header offer sorting, applied client-side over the
   * rows currently loaded (page-local). Anything else — including the default
   * — leaves the column unsortable, since the server cannot sort it.
   *
   * Paged tables only: `<AsWindowTable>` caches rows by absolute index, so
   * there is no page to re-order and the affordance is not offered there.
   */
  sortable?: false | "local";
  /**
   * The value `sortable: 'local'` orders by. A display column has no server
   * field behind it, so without this the sorter reads `row[key]` — which is
   * `undefined` unless the app happens to carry that key on the row. Ignored
   * when the column is not sorted locally.
   */
  sortValue?: (row: Record<string, unknown>) => unknown;
  /** Named cell component (`components[name]` on the table context). */
  component?: string;
  /** Cell type for the `types[type]` dispatch. Default `"text"`. */
  type?: string;
}

/** Columns with no explicit `order` land after every server column. */
const TRAILING_ORDER = Number.MAX_SAFE_INTEGER;

/** Turn a {@link DisplayColumnDef} into the `ColumnDef` the table renders. */
export function displayColumnToDef(def: DisplayColumnDef): ColumnDef {
  return {
    path: def.key,
    label: def.label,
    type: def.type ?? "text",
    component: def.component,
    // `local` + `sortable` is the predicate for "sorted in memory" — there is
    // no separate flag to keep in sync.
    sortable: def.sortable === "local",
    filterable: false,
    nullable: true,
    order: def.order ?? TRAILING_ORDER,
    width: def.width,
    local: true,
  };
}

/**
 * Merge client-owned columns into the server's column list, ordered by each
 * column's `order`. `Array#sort` is stable, so server columns that share an
 * `order` keep their `/meta` sequence. Returns `base` untouched when there is
 * nothing to merge.
 */
export function mergeDisplayColumns(
  base: ColumnDef[],
  display: readonly DisplayColumnDef[],
): ColumnDef[] {
  if (display.length === 0) return base;
  return [...base, ...display.map(displayColumnToDef)].toSorted((a, b) => a.order - b.order);
}
