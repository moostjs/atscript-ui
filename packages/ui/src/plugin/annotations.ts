import type { TAnnotationsTree } from "@atscript/core";
import { AnnotationSpec } from "@atscript/core";

const BUILTIN_TYPES = [
  "text",
  "password",
  "number",
  "decimal",
  "select",
  "textarea",
  "checkbox",
  "radio",
  "date",
  "datetime",
  "time",
  "paragraph",
  "action",
] as const;

const COL_SPAN_VALUES: string[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "full",
  "half",
  "third",
];

const ROW_SPAN_VALUES: string[] = ["1", "2", "3", "4", "5", "6"];

/**
 * Static `@ui.*` annotation specs registered by the `@atscript/ui` plugin.
 *
 * Namespace contract (see Decision 1 in design.md):
 * - `ui.<key>`        — explicit cross-surface shared (`type`)
 * - `ui.form.<key>`   — form-only static
 * - `ui.table.<key>`  — table-only static
 * - `ui.dict.<key>`   — value-help annotations
 * - `ui.array.<key>`  — array control annotations
 *
 * The dynamic `ui.form.fn.*` / `ui.table.fn.*` and `ui.form.validate` specs
 * are declared by `@atscript/ui-fns`.
 */
export const uiAnnotations: TAnnotationsTree = {
  ui: {
    // ── Cross-surface shared root ─────────────────────────────────

    type: new AnnotationSpec({
      description:
        "Cell + input renderer type override applied to whichever surface lacks its own override " +
        "(`ui.form.type` / `ui.table.type`). Built-in types: " +
        BUILTIN_TYPES.join(", ") +
        ". Consumers may dispatch additional custom types via the renderer registry — the " +
        "argument is intentionally open-ended." +
        "\n\n**Example:**\n" +
        "```atscript\n" +
        '@ui.type "currency"\n' +
        "amount: number\n" +
        "```\n",
      nodeType: ["prop", "type"],
      argument: {
        name: "type",
        type: "string",
        description: "The renderer type used by both form input and table cell unless overridden.",
      },
    }),

    // ── Form-side static annotations ──────────────────────────────

    form: {
      placeholder: new AnnotationSpec({
        description:
          "Defines **placeholder text** for UI input fields." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.form.placeholder "Enter your name"\n' +
          "name: string\n" +
          "```\n",
        nodeType: ["prop", "type"],
        argument: {
          name: "text",
          type: "string",
          description: "The placeholder text to display in UI input fields.",
        },
      }),

      hint: new AnnotationSpec({
        description:
          "Provides **help text or tooltip** displayed near the field in UI forms." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.form.hint "Must be a valid business email"\n' +
          "email: string.email\n" +
          "```\n",
        nodeType: ["prop", "type"],
        argument: {
          name: "text",
          type: "string",
          description: "Help text or tooltip content.",
        },
      }),

      classes: new AnnotationSpec({
        description:
          "Adds **CSS class names** to the rendered field. " +
          "Multiple `@ui.form.classes` annotations are appended." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.form.classes "text-bold"\n' +
          '@ui.form.classes "mt-4"\n' +
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

      styles: new AnnotationSpec({
        description:
          "Adds **inline CSS styles** to the rendered field. " +
          "Multiple `@ui.form.styles` annotations are appended." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.form.styles "color: red"\n' +
          '@ui.form.styles "font-weight: bold"\n' +
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
          '@ui.form.autocomplete "email"\n' +
          "email: string.email\n" +
          "```\n",
        nodeType: ["prop", "type"],
        argument: {
          name: "value",
          type: "string",
          description: "HTML autocomplete attribute value.",
        },
      }),

      disabled: new AnnotationSpec({
        description: "Statically mark this field as disabled in the form.",
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

      order: new AnnotationSpec({
        description: "Explicit form-field ordering (lower values render first).",
        nodeType: ["prop", "type"],
        argument: {
          name: "order",
          type: "number",
          description: "Numeric order (lower = earlier)",
        },
      }),

      type: new AnnotationSpec({
        description:
          "Form input type override. Wins over the shared `@ui.type` for this prop's form input. " +
          "Built-in types: " +
          BUILTIN_TYPES.join(", ") +
          ". The argument is intentionally open-ended — consumers may register additional types in " +
          "the form `types` map (same extensibility pattern as `@ui.type` / `@ui.table.type`).",
        nodeType: ["prop", "type"],
        argument: {
          name: "type",
          type: "string",
          // No `values` constraint: keeping this open-ended is what makes the
          // `types` map extension contract actually useful — restricting the
          // argument to BUILTIN_TYPES would block legitimate custom renderers.
          description: "The input type used by `<as-field>` for this prop.",
        },
      }),

      component: new AnnotationSpec({
        description: "Named component override for the form-side renderer.",
        nodeType: ["prop", "interface", "type"],
        argument: {
          name: "name",
          type: "string",
          description: "Component name from the form components registry",
        },
      }),

      hidden: new AnnotationSpec({
        description: "Statically hide this field in the form.",
        nodeType: ["prop", "type"],
      }),

      attr: new AnnotationSpec({
        description:
          "Custom attribute or component prop applied to the form input. Repeat for each attr. Passed via v-bind.",
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

      grid: {
        colSpan: new AnnotationSpec({
          description:
            "Grid column span for the field in auto-generated forms. " +
            'Accepts numeric strings `"1"` to `"12"` or aliases `"full"` (12), `"half"` (6), `"third"` (4). ' +
            'Optional second argument applies inside narrow containers (≤480px); defaults to `"full"` when omitted.' +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            '@ui.form.grid.colSpan "6", "12"  // half-width desktop, full-width narrow\n' +
            "firstName: string\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: [
            {
              name: "desktop",
              type: "string",
              description:
                'Column span for non-narrow containers. "1"-"12", "full", "half", or "third".',
              values: COL_SPAN_VALUES,
            },
            {
              name: "narrow",
              type: "string",
              optional: true,
              description: 'Column span for containers ≤480px wide. Defaults to "full".',
              values: COL_SPAN_VALUES,
            },
          ],
        }),
        rowSpan: new AnnotationSpec({
          description:
            'Grid row span for the field. Accepts numeric strings `"1"` to `"6"`. ' +
            'Optional second argument applies inside narrow containers (≤480px); defaults to `"1"` when omitted.' +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            '@ui.form.grid.rowSpan "2"\n' +
            "bio: string\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: [
            {
              name: "desktop",
              type: "string",
              description: 'Row span for non-narrow containers. "1"-"6".',
              values: ROW_SPAN_VALUES,
            },
            {
              name: "narrow",
              type: "string",
              optional: true,
              description: 'Row span for containers ≤480px wide. Defaults to "1".',
              values: ROW_SPAN_VALUES,
            },
          ],
        }),
      },

      icon: new AnnotationSpec({
        description:
          "Prepended input icon for `<as-field>`. Resolved through the ui-styles icon registry." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.form.icon "mail"\n' +
          "email: string.email\n" +
          "```\n",
        nodeType: ["prop", "type", "interface"],
        argument: {
          name: "name",
          type: "string",
          description: "Icon name registered with the ui-styles icon registry.",
        },
      }),

      submit: {
        text: new AnnotationSpec({
          description: "Static submit button text.",
          nodeType: ["interface", "type"],
          argument: {
            name: "text",
            type: "string",
            description: "Submit button label",
          },
        }),
      },

      label: {
        singular: new AnnotationSpec({
          description:
            "Singular label form for an array field. Used by AsArray to render " +
            '"Add <singular>" / "Remove <singular>" / per-item "#N"-suffixed ' +
            "labels. When omitted, the array falls back to `'item'`." +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            "@meta.label 'Phone numbers'\n" +
            "@ui.form.label.singular 'phone number'\n" +
            "phones: string[]\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: {
            name: "singular",
            type: "string",
            description: 'Singular label, e.g. "phone number" for a `phones` field.',
          },
        }),
      },

      action: new AnnotationSpec({
        description: "Form action button for this field.",
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

      prefix: {
        $self: new AnnotationSpec({
          description:
            "Literal **prefix adornment** rendered before the input value. " +
            "Works on all default inputs (`AsInput`, `AsNumber`, `AsDecimal`). " +
            "When set on a field that also carries `@db.amount.currency*`, the " +
            "explicit prefix wins — currency only contributes a prefix when " +
            "no explicit one is present." +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            '@ui.form.prefix "+1"\n' +
            "phone: string\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: {
            name: "value",
            type: "string",
            description: "Literal text to display before the input value.",
          },
        }),
        ref: new AnnotationSpec({
          description:
            "**Sibling-field reference** for the prefix adornment. The string " +
            "argument is the name of another field on the same parent whose " +
            "value will be displayed as the prefix at runtime. `@ui.form.prefix` " +
            "wins over `@ui.form.prefix.ref` when both are present." +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            "countryCode: string\n" +
            '@ui.form.prefix.ref "countryCode"\n' +
            "phone: string\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: {
            name: "field",
            type: "string",
            description: "Name of a sibling field whose value drives the prefix.",
          },
        }),
      },

      suffix: {
        $self: new AnnotationSpec({
          description:
            "Literal **suffix adornment** rendered after the input value. " +
            "Works on all default inputs. When set on a field that also " +
            "carries `@db.unit*`, the explicit suffix wins — unit code only " +
            "contributes a suffix when no explicit one is present." +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            '@ui.form.suffix "/hr"\n' +
            "rate: number\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: {
            name: "value",
            type: "string",
            description: "Literal text to display after the input value.",
          },
        }),
        ref: new AnnotationSpec({
          description:
            "**Sibling-field reference** for the suffix adornment. The string " +
            "argument is the name of another field on the same parent whose " +
            "value will be displayed as the suffix at runtime. `@ui.form.suffix` " +
            "wins over `@ui.form.suffix.ref` when both are present." +
            "\n\n**Example:**\n" +
            "```atscript\n" +
            "unit: 'kg' | 'lb'\n" +
            '@ui.form.suffix.ref "unit"\n' +
            "weight: number\n" +
            "```\n",
          nodeType: ["prop", "type"],
          argument: {
            name: "field",
            type: "string",
            description: "Name of a sibling field whose value drives the suffix.",
          },
        }),
      },
    },

    // ── Table-side static annotations ─────────────────────────────

    table: {
      width: new AnnotationSpec({
        description:
          "Sets the **default column width** for this field when rendered in a table. " +
          "Accepts any CSS width string (e.g. `120px`, `12em`, `20ch`). The user can " +
          "still resize the column manually; double-click on the resize handle " +
          "auto-fits to content; the column-menu Reset entry returns to this value." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.table.width "240px"\n' +
          "description: string\n" +
          "```\n",
        nodeType: ["prop", "type"],
        argument: {
          name: "width",
          type: "string",
          description: "CSS width for the column (e.g. '120px', '15em', '20ch').",
        },
      }),

      component: new AnnotationSpec({
        description: "Named component override for the table-cell renderer.",
        nodeType: ["prop", "interface", "type"],
        argument: {
          name: "name",
          type: "string",
          description: "Component name from the table components registry",
        },
      }),

      hidden: new AnnotationSpec({
        description: "Hide this column by default in the table.",
        nodeType: ["prop", "type"],
      }),

      attr: new AnnotationSpec({
        description:
          "Custom attribute or component prop applied to the rendered `<td>`. Repeat for each attr. Passed via v-bind.",
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
            name: "value",
            type: "string",
            description: "Static value applied to the cell.",
          },
        ],
      }),

      classes: new AnnotationSpec({
        description:
          "CSS classes applied to the rendered `<td>` for this column's cells. " +
          "Multiple `@ui.table.classes` annotations are appended." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.table.classes "font-bold"\n' +
          '@ui.table.classes "text-right"\n' +
          "amount: number\n" +
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

      styles: new AnnotationSpec({
        description:
          "Inline CSS styles applied to the rendered `<td>` for this column's cells. " +
          "Multiple `@ui.table.styles` annotations are appended." +
          "\n\n**Example:**\n" +
          "```atscript\n" +
          '@ui.table.styles "padding-left: 12px"\n' +
          "description: string\n" +
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

      type: new AnnotationSpec({
        description:
          "Cell renderer type override. Wins over the shared `@ui.type` for this prop's table cell. " +
          "Built-in types: " +
          BUILTIN_TYPES.join(", ") +
          ". Consumers may register additional types in the table types map; the argument is " +
          "intentionally open-ended.",
        nodeType: ["prop", "type"],
        argument: {
          name: "type",
          type: "string",
          description: "The cell renderer type dispatched via the table types map.",
        },
      }),

      order: new AnnotationSpec({
        description:
          "Initial column ordering — lower values appear first; user-driven runtime reorder still mutates table state's `columnNames`.",
        nodeType: ["prop", "type"],
        argument: {
          name: "order",
          type: "number",
          description: "Numeric order (lower = earlier)",
        },
      }),
    },

    // ── Dictionary annotations (value-help display + capabilities) ──
    //
    // `ui.dict.filterable` / `ui.dict.sortable` / `ui.dict.searchable` are
    // read **server-side** by moost-db's `AsValueHelpController` and emitted
    // into the `/meta` payload as `meta.fields[name].filterable/sortable` and
    // `meta.searchable` (+ the `searchable` field list). The picker UI gates
    // on those flags via the resolved TableDef — no additional client-side
    // wiring of these annotations is required for server-backed dicts.
    // (Same pattern: `AsDbReadableController` emits `meta.fields[*]` from
    // `db.table.filterable/sortable` + `db.column.filterable/sortable`.)
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

    // ── Array annotations ─────────────────────────────────────────

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
