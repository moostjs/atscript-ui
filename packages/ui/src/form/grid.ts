/** Grid layout parsing for `@ui.form.grid.colSpan` / `@ui.form.grid.rowSpan`. */

export const DEFAULT_COL_SPAN = 12;
export const DEFAULT_ROW_SPAN = 1;

const COL_SPAN_ALIASES: Record<string, number> = {
  full: 12,
  half: 6,
  third: 4,
};

/** Accepts "1"-"12" and the aliases "full" (12), "half" (6), "third" (4). */
export function parseColSpan(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const aliased = COL_SPAN_ALIASES[raw];
  if (aliased !== undefined) return aliased;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 12 && String(n) === raw) return n;
  return undefined;
}

/** Accepts numeric strings "1"+; rejects "0", negatives, decimals, aliases. */
export function parseRowSpan(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 1 && String(n) === raw) return n;
  return undefined;
}

export interface GridSpec {
  col: { desktop: number; narrow: number };
  row: { desktop: number; narrow: number };
}

/**
 * Shape returned by `getFieldMeta(prop, UI_FORM_GRID_COL_SPAN | …ROW_SPAN)` —
 * atscript codegen produces a struct from named multi-arg annotation specs.
 */
export interface GridSpanArgs {
  desktop: string;
  narrow?: string;
}

/**
 * Resolve a field's grid footprint. Narrow defaults to full-width / single-row
 * regardless of the desktop value, so authors can opt into a narrow override
 * via the second annotation arg without it inheriting an unintended desktop span.
 */
export function resolveGridSpec(
  colSpan: GridSpanArgs | undefined,
  rowSpan: GridSpanArgs | undefined,
): GridSpec {
  return {
    col: {
      desktop: parseColSpan(colSpan?.desktop) ?? DEFAULT_COL_SPAN,
      narrow: parseColSpan(colSpan?.narrow) ?? DEFAULT_COL_SPAN,
    },
    row: {
      desktop: parseRowSpan(rowSpan?.desktop) ?? DEFAULT_ROW_SPAN,
      narrow: parseRowSpan(rowSpan?.narrow) ?? DEFAULT_ROW_SPAN,
    },
  };
}

/**
 * Build the UnoCSS class string for a field's grid footprint.
 *
 * - Skips desktop classes that match the default (`as-grid-item` already
 *   covers `col-span-full row-span-1`).
 * - Skips narrow overrides that match the desktop value (no override needed).
 * - The narrow variant uses the custom `as-narrow:` prefix, which the
 *   atscript-ui UnoCSS preset rewrites to `@container as-grid (max-width:
 *   480px) { ... }`. The parent grid is registered as
 *   `container-name: as-grid` via the `as-form-grid` shortcut, so the
 *   rule resolves against the actual grid's inline size — not the viewport.
 *
 * Returned string is space-separated, ready to drop into a Vue class binding.
 */
export function buildGridClasses(spec: GridSpec): string {
  const out: string[] = [];
  if (spec.col.desktop !== DEFAULT_COL_SPAN) {
    out.push(`col-span-${spec.col.desktop}`);
  }
  if (spec.row.desktop !== DEFAULT_ROW_SPAN) {
    out.push(`row-span-${spec.row.desktop}`);
  }
  if (spec.col.narrow !== spec.col.desktop) {
    out.push(`as-narrow:col-span-${spec.col.narrow}`);
  }
  if (spec.row.narrow !== spec.row.desktop) {
    out.push(`as-narrow:row-span-${spec.row.narrow}`);
  }
  return out.join(" ");
}
