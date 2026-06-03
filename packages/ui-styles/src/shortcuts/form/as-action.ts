import { defineShortcuts } from "vunor/theme";

export const asActionShortcuts = defineShortcuts({
  // Alt actions on a form (`ui.action` phantom fields). The field IS the
  // [text] [link] flex row — `as-grid-item` carries the grid footprint (no
  // `as-default-field`, whose `flex-col` would fight the row direction).
  // `flex-wrap` lets a long prefix + link reflow on narrow grids;
  // `items-baseline` keeps the prefix text and link aligned. The link styling
  // lives directly on the `<button>` via `as-field-action-link` (applied in the
  // template) so its `:hover`/`:focus` underline binds to the button alone.
  "as-action-field": "as-grid-item flex flex-row flex-wrap items-baseline gap-$xs",
  // Prefix text before the action link (e.g. "Already have an account?").
  "as-action-text": "text-callout text-current/60",
  // Alignment of the action row, driven by `@ui.form.attr 'align', '...'`.
  "as-action-left": "justify-start text-left",
  "as-action-center": "justify-center text-center",
  "as-action-right": "justify-end text-right",
  // `self-end` right-aligns the form's primary submit on the cross axis of
  // `as-form`'s flex-col.
  "as-submit-btn": "scope-primary c8-filled btn self-end",

  // Paragraph-specific styling hook. `as-default-field` provides the grid
  // footprint; this layer carries readable typography distinct from the
  // input-row spacing inherited from the shared field shell.
  "as-paragraph-field": "text-body",
});
