import { defineShortcuts } from "vunor/theme";

/**
 * 12-col grid scaffold for form children. Every struct/array/tuple body wraps
 * its iteration in `as-form-grid`; every field's outer wrapper composes
 * `as-grid-item` (default `col-span-full row-span-1` footprint, identical
 * effect to today's stacked layout). Authors override the footprint via
 * `@ui.form.grid.colSpan` / `@ui.form.grid.rowSpan`; AsField stamps the
 * resolved classes (`col-span-N`, `row-span-N`, plus
 * `as-narrow:col-span-N` / `as-narrow:row-span-N` for the narrow track)
 * onto each field's outer wrapper.
 *
 * `[container-type:inline-size]` + `[container-name:as-grid]` register a
 * named CSS containment context so the narrow variant `as-narrow:` (defined
 * in the form-grid preset) resolves against this grid's inline size — not
 * the viewport. Nested grids re-evaluate independently, so an inner grid
 * inside a `colSpan "6"` slot stacks automatically when the outer hits
 * narrow.
 */
export const asFormGridShortcuts = defineShortcuts({
  "as-form-grid":
    "grid grid-cols-12 gap-$m [container-type:inline-size] [container-name:as-grid]",
  "as-grid-item": "col-span-full row-span-1",
});
