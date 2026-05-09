import { defineShortcuts } from "vunor/theme";

/**
 * 12-col grid scaffold for form children. Every struct/array/tuple body wraps
 * its iteration in `as-form-grid`; every field's outer wrapper composes
 * `as-grid-item` (default `col-span-full row-span-1` footprint, identical
 * effect to today's stacked layout). Authors override the footprint via
 * `@ui.form.grid.colSpan` / `@ui.form.grid.rowSpan` (Phase 3 wiring).
 *
 * `[container-type:inline-size]` makes each grid a CSS containment context
 * so a future `@container (max-width: 480px)` variant can re-stack to
 * full-width based on the actual slot the grid occupies — not viewport.
 */
export const asFormGridShortcuts = defineShortcuts({
  "as-form-grid": "grid grid-cols-12 gap-$m [container-type:inline-size]",
  "as-grid-item": "col-span-full row-span-1",
});
