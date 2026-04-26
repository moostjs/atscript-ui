import type { TAnnotationsTree } from "@atscript/core";
import { AnnotationSpec } from "@atscript/core";

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

/**
 * Static `@ui.*` annotation specs registered by `@atscript/ui` plugin.
 *
 * Merged from `@atscript/core` defaults and `@atscript/ui-fns` static annotations.
 * Where both defined the same key, the ui-fns version is used (more complete).
 */
export const uiAnnotations: TAnnotationsTree = {
  ui: {
    // ── Field-level annotations (from core, unique to core) ──────────

    placeholder: new AnnotationSpec({
      description:
        "Defines **placeholder text** for UI input fields." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.placeholder "Enter your name"\n' +
        "name: string\n" +
        "```\n",
      nodeType: ["prop", "type"],
      argument: {
        name: "text",
        type: "string",
        description: "The placeholder text to display in UI input fields.",
      },
    }),

    group: new AnnotationSpec({
      description:
        "Groups fields into **form sections**. Fields sharing the same group name are rendered together." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.group "personal"\n' +
        "firstName: string\n" +
        "\n" +
        '@ui.group "personal"\n' +
        "lastName: string\n" +
        "\n" +
        '@ui.group "contact"\n' +
        "email: string.email\n" +
        "```\n",
      nodeType: ["prop"],
      argument: {
        name: "name",
        type: "string",
        description: "The section/group name to place this field in.",
      },
    }),

    field: {
      width: new AnnotationSpec({
        description:
          "Provides a **layout width hint** for the field in auto-generated forms." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.field.width "half"\n' +
          "firstName: string\n" +
          "```\n",
        nodeType: ["prop", "type"],
        argument: {
          name: "width",
          type: "string",
          description: 'Layout width hint (e.g., "half", "full", "third", "quarter").',
        },
      }),
    },

    table: {
      column: {
        width: new AnnotationSpec({
          description:
            "Sets the **default column width** for this field when rendered in a table. " +
            "Accepts any CSS width string (e.g. `120px`, `12em`, `20ch`). The user can " +
            "still resize the column manually; double-click on the resize handle " +
            "auto-fits to content; the column-menu Reset entry returns to this value." +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            '@ui.table.column.width "240px"\n' +
            "description: string\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: {
            name: "width",
            type: "string",
            description: "CSS width for the column (e.g. '120px', '15em', '20ch').",
          },
        }),
      },
    },

    icon: new AnnotationSpec({
      description:
        "Provides an **icon hint** for the field or entity." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.icon "mail"\n' +
        "email: string.email\n" +
        "```\n",
      nodeType: ["prop", "type", "interface"],
      argument: {
        name: "name",
        type: "string",
        description: "Icon name or identifier.",
      },
    }),

    hint: new AnnotationSpec({
      description:
        "Provides **help text or tooltip** displayed near the field in UI forms." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.hint "Must be a valid business email"\n' +
        "email: string.email\n" +
        "```\n",
      nodeType: ["prop", "type"],
      argument: {
        name: "text",
        type: "string",
        description: "Help text or tooltip content.",
      },
    }),

    class: new AnnotationSpec({
      description:
        "Adds **CSS class names** to the rendered field or entity. " +
        "Multiple `@ui.class` annotations are appended." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.class "text-bold"\n' +
        '@ui.class "mt-4"\n' +
        "title: string\n" +
        "```\n",
      nodeType: ["prop", "type", "interface"],
      multiple: true,
      mergeStrategy: "append",
      argument: {
        name: "names",
        type: "string",
        description: "One or more CSS class names (space-separated).",
      },
    }),

    style: new AnnotationSpec({
      description:
        "Adds **inline CSS styles** to the rendered field or entity. " +
        "Multiple `@ui.style` annotations are appended." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.style "color: red"\n' +
        '@ui.style "font-weight: bold"\n' +
        "warning: string\n" +
        "```\n",
      nodeType: ["prop", "type", "interface"],
      multiple: true,
      mergeStrategy: "append",
      argument: {
        name: "css",
        type: "string",
        description: "CSS style declarations (semicolon-separated).",
      },
    }),

    autocomplete: new AnnotationSpec({
      description:
        "Provides an **autocomplete hint** for the rendered input field." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.autocomplete "email"\n' +
        "email: string.email\n" +
        "```\n",
      nodeType: ["prop", "type"],
      argument: {
        name: "value",
        type: "string",
        description: "HTML autocomplete attribute value.",
      },
    }),

    // ── Field-level annotations (from ui-fns, more complete) ─────────

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

    // ── Form-level annotations ───────────────────────────────────

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

    // ── Action annotation ────────────────────────────────────────

    form: {
      action: new AnnotationSpec({
        description: "Form action button for this field",
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
    },

    // ── Dictionary annotations (value-help display + capabilities) ────
    dict: {
      label: new AnnotationSpec({
        description:
          "Marks this field as the primary display label when the table is used as a value-help dictionary",
        nodeType: ["prop"],
      }),
      descr: new AnnotationSpec({
        description: "Marks this field as the secondary description in value-help display",
        nodeType: ["prop"],
      }),
      attr: new AnnotationSpec({
        description: "Marks this field as an additional attribute column in table-mode value help",
        nodeType: ["prop"],
        multiple: true,
        mergeStrategy: "append",
      }),
      filterable: new AnnotationSpec({
        description:
          "Marks this field as filterable in the value-help picker UI. Surfaced via `meta.fields[name].filterable` on value-help `/meta` responses.",
        nodeType: ["prop"],
      }),
      sortable: new AnnotationSpec({
        description:
          "Marks this field as sortable in the value-help picker UI. Surfaced via `meta.fields[name].sortable` on value-help `/meta` responses.",
        nodeType: ["prop"],
      }),
      searchable: new AnnotationSpec({
        description:
          "Marks a prop as participating in `$search`, or — on an interface — marks every `string` prop on the target as searchable. Surfaced via `meta.searchable` on value-help `/meta` responses.",
        nodeType: ["prop", "interface"],
      }),
    },

    // ── Array annotations ────────────────────────────────────────

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
  },
};
