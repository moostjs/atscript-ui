import {
  getFieldMeta,
  parseStaticAttrs,
  resolveFieldProp,
  resolveAttrs,
  UI_TABLE_ATTR,
  UI_TABLE_CLASSES,
  UI_TABLE_FN_ATTR,
  UI_TABLE_FN_CLASSES,
  UI_TABLE_FN_STYLES,
  UI_TABLE_STYLES,
  type ColumnDef,
  type TableDef,
} from "@atscript/ui";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { computed, type ComputedRef } from "vue";
import type { ReactiveTableState } from "../types";
import { useTableContextOptional } from "./use-table-state";

/**
 * Resolved per-cell bindings produced by the cell resolver. Flat shape so
 * `v-bind="bindings"` applies `class` + `style` + every attr in one go.
 */
type CellBindings = {
  class?: unknown;
  style?: unknown;
} & Record<string, unknown>;

/**
 * Resolve `(column, row, rowIndex) => CellBindings` for one cell. Off-screen
 * rows pay nothing — virtualised renderers only invoke this for visible cells.
 */
export type CellResolver = (
  column: ColumnDef,
  row: Record<string, unknown>,
  rowIndex: number,
) => CellBindings;

/** Frozen sentinel for columns with no cell-level annotations. */
const EMPTY_BINDINGS: CellBindings = Object.freeze({}) as CellBindings;

const TABLE_FN_KEYS = { staticKey: UI_TABLE_ATTR, fnKey: UI_TABLE_FN_ATTR } as const;

interface ColumnMeta {
  prop: TAtscriptAnnotatedType;
  hasClasses: boolean;
  hasStyles: boolean;
  hasAttrs: boolean;
  /** True when any `@ui.table.fn.*` is present — only then does scope.ctx need to be built. */
  hasAnyFn: boolean;
  /** True when at least one of class/style/attr (static or dynamic) is set. */
  hasAny: boolean;
  /**
   * Cached bindings for static-only columns. Populated on first hit and reused
   * for every cell render — avoids per-cell metadata reads and object allocation.
   */
  staticBindings?: CellBindings;
}

/**
 * Per-`TableDef.type` cache of column resolution metadata. Avoids re-probing
 * per-key annotations on every cell render. The flat type tree itself is
 * already pre-built on `TableDef.flatMap`.
 */
const metaCache = new WeakMap<TAtscriptAnnotatedType, Map<string, ColumnMeta>>();

function getColumnMetaMap(def: TableDef): Map<string, ColumnMeta> {
  let map = metaCache.get(def.type);
  if (map) return map;

  map = new Map();
  for (const [path, prop] of def.flatMap.entries()) {
    if (path === "") continue;
    const m = prop.metadata;
    const hasFnClasses = m.has(UI_TABLE_FN_CLASSES as keyof AtscriptMetadata);
    const hasFnStyles = m.has(UI_TABLE_FN_STYLES as keyof AtscriptMetadata);
    const hasFnAttrs = m.has(UI_TABLE_FN_ATTR as keyof AtscriptMetadata);
    const hasClasses = hasFnClasses || m.has(UI_TABLE_CLASSES as keyof AtscriptMetadata);
    const hasStyles = hasFnStyles || m.has(UI_TABLE_STYLES as keyof AtscriptMetadata);
    const hasAttrs = hasFnAttrs || m.has(UI_TABLE_ATTR as keyof AtscriptMetadata);
    const hasAny = hasClasses || hasStyles || hasAttrs;
    if (!hasAny) continue;
    map.set(path, {
      prop,
      hasClasses,
      hasStyles,
      hasAttrs,
      hasAnyFn: hasFnClasses || hasFnStyles || hasFnAttrs,
      hasAny,
    });
  }
  metaCache.set(def.type, map);
  return map;
}

export interface UseCellResolverResult {
  resolve: CellResolver;
  /**
   * True when any column on the current TableDef has cell-level annotations.
   * Consumers gate the cell-resolver template branch on this — unannotated
   * tables skip the per-cell `cellResolver(...)` call (and the `v-bind`)
   * entirely.
   */
  hasAnyCellBindings: ComputedRef<boolean>;
}

/**
 * Per-row cell composable.
 *
 * Returns `{ resolve, hasAnyCellBindings }`:
 * - `resolve(column, row, rowIndex)` produces `CellBindings`. For columns with
 *   no `@ui.table.classes` / `@ui.table.styles` / `@ui.table.attr` (static or
 *   dynamic), it short-circuits to a frozen empty object — no scope build, no
 *   reactive reads, no allocations. Static-only columns reuse a cached object.
 * - `hasAnyCellBindings` is `false` when no column on the def has any of the
 *   above annotations — consumers should skip calling `resolve` entirely.
 */
export function useCellResolver(getTableDef: () => TableDef | null): UseCellResolverResult {
  const ctx = useTableContextOptional();
  const state = ctx?.state;

  const hasAnyCellBindings = computed(() => {
    const def = getTableDef();
    return !!def && getColumnMetaMap(def).size > 0;
  });

  const resolve: CellResolver = (column, row, rowIndex) => {
    const def = getTableDef();
    if (!def) return EMPTY_BINDINGS;
    const colMeta = getColumnMetaMap(def).get(column.path);
    if (!colMeta) return EMPTY_BINDINGS;

    if (!colMeta.hasAnyFn) {
      return (colMeta.staticBindings ??= buildStaticBindings(colMeta));
    }

    const scope = buildScope(state, row, rowIndex);
    const cls = colMeta.hasClasses
      ? resolveFieldProp(colMeta.prop, UI_TABLE_FN_CLASSES, UI_TABLE_CLASSES, scope)
      : undefined;
    const style = colMeta.hasStyles
      ? resolveFieldProp(colMeta.prop, UI_TABLE_FN_STYLES, UI_TABLE_STYLES, scope)
      : undefined;
    const attrs = colMeta.hasAttrs ? resolveAttrs(colMeta.prop, scope, TABLE_FN_KEYS) : undefined;

    if (!attrs && cls === undefined && style === undefined) return EMPTY_BINDINGS;

    const out: CellBindings = attrs ? { ...attrs } : {};
    if (cls !== undefined) out.class = cls;
    if (style !== undefined) out.style = style;
    return out;
  };

  return { resolve, hasAnyCellBindings };
}

function buildStaticBindings(colMeta: ColumnMeta): CellBindings {
  const cls = colMeta.hasClasses ? getFieldMeta(colMeta.prop, UI_TABLE_CLASSES) : undefined;
  const style = colMeta.hasStyles ? getFieldMeta(colMeta.prop, UI_TABLE_STYLES) : undefined;
  const attrs = colMeta.hasAttrs
    ? parseStaticAttrs(getFieldMeta(colMeta.prop, UI_TABLE_ATTR))
    : undefined;

  if (!attrs && cls === undefined && style === undefined) return EMPTY_BINDINGS;

  const out: CellBindings = attrs ? { ...attrs } : {};
  if (cls !== undefined) out.class = cls;
  if (style !== undefined) out.style = style;
  return out;
}

function buildScope(
  state: ReactiveTableState | undefined,
  row: Record<string, unknown>,
  rowIndex: number,
): Record<string, unknown> {
  return {
    row,
    ctx: {
      searchTerm: state?.searchTerm.value ?? "",
      filters: state?.filters.value ?? {},
      sorters: state?.sorters.value ?? [],
      rowIndex,
    },
  } as unknown as Record<string, unknown>;
}
