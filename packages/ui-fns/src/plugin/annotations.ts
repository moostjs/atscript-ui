import type { TAnnotationsTree, TMessages } from "@atscript/core";
import { AnnotationSpec } from "@atscript/core";

/**
 * Validates a function string by attempting to compile it with `new Function`.
 * Used by `ui.fn.*` and `ui.validate` annotation validate hooks.
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

function makeFnAnnotation(description: string, mode: "field" | "top"): AnnotationSpec {
  return new AnnotationSpec({
    description,
    nodeType: mode === "field" ? ["prop", "type"] : ["interface", "type"],
    argument: {
      name: "fn",
      type: "string",
      description:
        mode === "field"
          ? "JS function string: (value, data, context, entry) => result"
          : "JS function string: (data, context) => result",
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

/**
 * Annotation specs for `ui.fn.*` computed field properties and `ui.validate`.
 *
 * These are registered as atscript annotations via the `uiFnsPlugin()`.
 */
export const uiFnsAnnotations: TAnnotationsTree = {
  ui: {
    // ── Custom validation (dynamic fn) ────────────────────────
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

    // ── Computed (fn) annotations ─────────────────────────────
    fn: {
      // Form-level computed
      title: fnTopAnnotation("Computed title: (data, context) => string"),
      submit: {
        text: fnTopAnnotation("Computed submit button text: (data, context) => string"),
        disabled: fnTopAnnotation("Computed submit disabled state: (data, context) => boolean"),
      },

      // Field-level computed
      label: fnAnnotation("Computed label: (value, data, context, entry) => string"),
      description: fnAnnotation("Computed description: (value, data, context, entry) => string"),
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
      attr: new AnnotationSpec({
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
      }),
    },
  },
};
