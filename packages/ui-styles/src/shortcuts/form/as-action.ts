import { defineShortcuts } from "vunor/theme";

export const asActionShortcuts = defineShortcuts({
  // Alt actions on a form (`ui.action` phantom fields). Default look mirrors
  // the alt-action link rendered inside `as-field-shell`'s footer row, and
  // `items-start` left-aligns the button on the cross axis of the field's
  // flex-col container.
  "as-action-field": {
    "": "items-start",
    "[&>button]:": "as-field-action-link",
  },
  // `self-end` right-aligns the form's primary submit on the cross axis of
  // `as-form`'s flex-col.
  "as-submit-btn": "scope-primary c8-filled btn self-end",

  // Paragraph-specific styling hook. `as-default-field` provides the grid
  // footprint; this layer carries readable typography distinct from the
  // input-row spacing inherited from the shared field shell.
  "as-paragraph-field": "text-body",
});
