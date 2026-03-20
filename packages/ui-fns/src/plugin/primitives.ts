import type { TAtscriptConfig } from "@atscript/core";

/**
 * UI primitive types for atscript `.as` files.
 *
 * These register `ui.paragraph`, `ui.action`, `ui.select`, `ui.radio`, and `ui.checkbox`
 * as first-class types usable in interface property definitions.
 */
export const uiPrimitives: TAtscriptConfig["primitives"] = {
  ui: {
    type: "phantom",
    isContainer: true,
    documentation: "Non-data UI elements for form rendering",
    extensions: {
      action: {
        documentation:
          "Form action button — not a data field, excluded from form data. Use with @ui.altAction to define alternate submit actions.",
      },
      paragraph: {
        documentation:
          "Read-only paragraph text — rendered as static content, not an input field. Use @meta.default for static text or @ui.fn.value for computed text.",
      },
      select: {
        type: "string",
        documentation:
          "Dropdown select field. Use @ui.options to define static choices or @ui.fn.options for computed choices.",
      },
      radio: {
        type: "string",
        documentation:
          "Radio button group. Use @ui.options to define static choices or @ui.fn.options for computed choices.",
      },
      checkbox: {
        type: "boolean",
        documentation: "Single boolean checkbox toggle.",
      },
    },
  },
};
