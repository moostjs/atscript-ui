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
const BUILTIN_TYPES = [
  "text",
  "password",
  "number",
  "select",
  "textarea",
  "checkbox",
  "radio",
  "date",
  "paragraph",
  "action",
] as const;

export const uiFnsAnnotations: TAnnotationsTree = {
  ui: {
    // ── Form-level static annotations ────────────────────────
    title: new AnnotationSpec({
      description: "Static title for the form or a nested group/array section",
      nodeType: ["interface", "type", "prop"],
      argument: {
        name: "title",
        type: "string",
        description: "The title text",
      },
    }),

    submit: {
      text: new AnnotationSpec({
        description: "Static submit button text",
        nodeType: ["interface", "type"],
        argument: {
          name: "text",
          type: "string",
          description: "Submit button label",
        },
      }),
      disabled: new AnnotationSpec({
        description: "Statically disable the submit button",
        nodeType: ["interface", "type"],
      }),
    },

    // ── Field-level static annotations ───────────────────────
    type: new AnnotationSpec({
      description: "Field input type",
      nodeType: ["prop", "type"],
      argument: {
        name: "type",
        type: "string",
        values: [...BUILTIN_TYPES],
        description: "The input type for this field",
      },
    }),

    component: new AnnotationSpec({
      description: "Named component override for rendering this field or type",
      nodeType: ["prop", "interface", "type"],
      argument: {
        name: "name",
        type: "string",
        description: "Component name from the components registry",
      },
    }),

    altAction: new AnnotationSpec({
      description: "Alternate action for this field",
      nodeType: ["prop", "type"],
      argument: [
        {
          name: "id",
          type: "string",
          description: "The action name emitted on trigger",
        },
        {
          name: "label",
          type: "string",
          optional: true,
          description: "Display label for the action (falls back to @meta.label)",
        },
      ],
    }),

    order: new AnnotationSpec({
      description: "Explicit rendering order for this field",
      nodeType: ["prop", "type"],
      argument: {
        name: "order",
        type: "number",
        description: "Numeric order (lower = earlier)",
      },
    }),

    hidden: new AnnotationSpec({
      description: "Statically mark this field as hidden",
      nodeType: ["prop", "type"],
    }),

    disabled: new AnnotationSpec({
      description: "Statically mark this field as disabled",
      nodeType: ["prop", "type"],
    }),

    readonly: new AnnotationSpec({
      description: "Statically mark this field as readonly",
      nodeType: ["prop", "type"],
    }),

    options: new AnnotationSpec({
      description:
        "Static option for select/radio fields. Repeat for each option. Label is the display text, value is the key (defaults to label).",
      nodeType: ["prop", "type"],
      multiple: true,
      mergeStrategy: "replace",
      argument: [
        {
          name: "label",
          type: "string",
          description: "Display label for the option",
        },
        {
          name: "value",
          type: "string",
          optional: true,
          description: "Value/key for the option (defaults to label if omitted)",
        },
      ],
    }),

    attr: new AnnotationSpec({
      description:
        "Custom attribute or component prop. Repeat for each attr. Passed to rendered component via v-bind.",
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
          name: "value",
          type: "string",
          description: "Static value (string, number, boolean, or undefined)",
        },
      ],
    }),

    // ── Array annotations ──────────────────────────────────
    array: {
      add: {
        label: new AnnotationSpec({
          description: 'Label for the add-item button (default: "Add item")',
          nodeType: ["prop"],
          argument: {
            name: "label",
            type: "string",
            description: "Button label text",
          },
        }),
      },
      remove: {
        label: new AnnotationSpec({
          description: 'Label for the remove-item button (default: "Remove")',
          nodeType: ["prop"],
          argument: {
            name: "label",
            type: "string",
            description: "Button label text",
          },
        }),
      },
    },

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
