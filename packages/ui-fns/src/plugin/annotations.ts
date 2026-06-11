import type { TAnnotationsTree, TMessages } from "@atscript/core";
import { AnnotationSpec } from "@atscript/core";

/**
 * Validates a function string by attempting to compile it with `new Function`.
 * Used by `ui.form.fn.*` / `ui.table.fn.*` and `ui.form.validate` annotation validate hooks.
 */
function validateFnString(
  fnStr: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
): TMessages | undefined {
  try {
    // eslint-disable-next-line no-new-func
    new Function("v", "data", "context", "entry", `return (${fnStr})(v, data, context, entry)`);
  } catch (error) {
    return [
      {
        severity: 1,
        message: `Invalid function string: ${(error as Error).message}`,
        range,
      },
    ];
  }
  return undefined;
}

const FN_MODES = {
  field: {
    nodeType: ["prop", "type"],
    argDoc: "(value, data, context, entry) => result",
  },
  top: {
    nodeType: ["interface", "type"],
    argDoc: "(data, context) => result",
  },
  both: {
    nodeType: ["prop", "interface", "type"],
    argDoc:
      "(value, data, context, entry) => result on fields; " +
      "(data, context) => result on the root interface",
  },
} as const;

function makeFnAnnotation(description: string, mode: keyof typeof FN_MODES): AnnotationSpec {
  return new AnnotationSpec({
    description,
    nodeType: [...FN_MODES[mode].nodeType],
    argument: {
      name: "fn",
      type: "string",
      description: `JS function string: ${FN_MODES[mode].argDoc}`,
    },
    validate: validateFirstArg,
  });
}

/** Shared validate hook: validates the fn string at args[0]. */
function validateFirstArg(
  _token: unknown,
  args: { text: string; range: Parameters<typeof validateFnString>[1] }[],
): TMessages | undefined {
  if (args[0]) {
    return validateFnString(args[0].text, args[0].range);
  }
  return undefined;
}

const fnAnnotation = (description: string) => makeFnAnnotation(description, "field");
const fnTopAnnotation = (description: string) => makeFnAnnotation(description, "top");
const fnBothAnnotation = (description: string) => makeFnAnnotation(description, "both");

const TABLE_ROW_SCOPE_DOC =
  "Receives `{ row, ctx }` where `row` is the current row's data object and `ctx` carries " +
  "table-level context (minimum keys: `searchTerm`, `filters`, `sorters`, `rowIndex`). " +
  "Per-row+cell scope only — every expression must be meaningful when applied to a single cell.";

function tableFnAnnotation(description: string): AnnotationSpec {
  return new AnnotationSpec({
    description: `${description}\n\n${TABLE_ROW_SCOPE_DOC}`,
    nodeType: ["prop", "type"],
    argument: {
      name: "fn",
      type: "string",
      description: "JS function string evaluated against the per-row scope `{ row, ctx }`.",
    },
    validate: validateFirstArg,
  });
}

const fnAttrSpec = new AnnotationSpec({
  description:
    "Computed custom attribute/prop. Name is the attribute/prop name, fn returns the value.",
  nodeType: ["prop", "type"],
  multiple: true,
  mergeStrategy: "replace",
  argument: [
    {
      name: "name",
      type: "string",
      description: 'Attribute/prop name (e.g., "data-testid", "variant", "size")',
    },
    {
      name: "fn",
      type: "string",
      description: "JS function string: (value, data, context, entry) => any",
    },
  ],
  validate(_token, args) {
    if (args[1]) {
      return validateFnString(args[1].text, args[1].range);
    }
    return undefined;
  },
});

const tableFnAttrSpec = new AnnotationSpec({
  description:
    "Per-row computed attribute/prop applied to the rendered `<td>`. Name is the attribute/prop name, fn returns the value.\n\n" +
    TABLE_ROW_SCOPE_DOC,
  nodeType: ["prop", "type"],
  multiple: true,
  mergeStrategy: "replace",
  argument: [
    {
      name: "name",
      type: "string",
      description: 'Attribute/prop name (e.g., "title", "data-row", "aria-label")',
    },
    {
      name: "fn",
      type: "string",
      description: "JS function string evaluated against the per-row scope `{ row, ctx }`.",
    },
  ],
  validate(_token, args) {
    if (args[1]) {
      return validateFnString(args[1].text, args[1].range);
    }
    return undefined;
  },
});

/**
 * Annotation specs for dynamic computed annotations and `ui.form.validate`.
 *
 * Registered as atscript annotations via the `uiFnsPlugin()`.
 * Static `@ui.*` annotations and primitives are provided by `@atscript/ui/plugin`.
 */
export const uiFnsAnnotations: TAnnotationsTree = {
  ui: {
    // ── Form-side computed (fn) + custom validation ───────────
    form: {
      validate: new AnnotationSpec({
        description:
          "Custom JS validator function string. Returns true for pass, or an error message string.",
        nodeType: ["prop", "type"],
        multiple: true,
        mergeStrategy: "append",
        argument: {
          name: "fn",
          type: "string",
          description: "JS function string: (value, data, context, entry) => boolean | string",
        },
        validate: validateFirstArg,
      }),

      fn: {
        // Form-level computed
        title: fnTopAnnotation("Computed form title: (data, context) => string"),
        submit: {
          text: fnTopAnnotation("Computed submit button text: (data, context) => string"),
          disabled: fnTopAnnotation("Computed submit disabled state: (data, context) => boolean"),
        },

        // Field-level computed (description also allowed on the root
        // interface, where it is a FORM-level fn `(data, context)` — same
        // contract as `ui.form.fn.title`)
        label: fnAnnotation("Computed label: (value, data, context, entry) => string"),
        description: fnBothAnnotation(
          "Computed description: (value, data, context, entry) => string on fields; " +
            "(data, context) => string on the root interface",
        ),
        hint: fnAnnotation("Computed hint: (value, data, context, entry) => string"),
        placeholder: fnAnnotation("Computed placeholder: (value, data, context, entry) => string"),
        disabled: fnAnnotation("Computed disabled state: (value, data, context, entry) => boolean"),
        hidden: fnAnnotation("Computed hidden state: (value, data, context, entry) => boolean"),
        readonly: fnAnnotation("Computed readonly state: (value, data, context, entry) => boolean"),
        value: fnAnnotation("Computed default value: (value, data, context, entry) => any"),
        classes: fnAnnotation(
          "Computed CSS classes: (value, data, context, entry) => string | Record<string, boolean>",
        ),
        styles: fnAnnotation(
          "Computed inline styles: (value, data, context, entry) => string | Record<string, string>",
        ),
        options: fnAnnotation(
          "Computed select/radio options: (value, data, context, entry) => Array",
        ),
        attr: fnAttrSpec,
      },
    },

    // ── Table-side computed (fn) annotations — per-row+cell scope only ──
    // No `hidden` / `width` / `type` / `component` / `order` (column-level decisions, not per-row).
    table: {
      fn: {
        attr: tableFnAttrSpec,
        classes: tableFnAnnotation(
          "Per-row computed CSS classes for the cell `<td>`: " +
            "`(row, ctx) => string | Record<string, boolean>`",
        ),
        styles: tableFnAnnotation(
          "Per-row computed inline styles for the cell `<td>`: " +
            "`(row, ctx) => string | Record<string, string>`",
        ),
      },
    },
  },
};
