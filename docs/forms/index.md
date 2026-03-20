# Forms

Atscript UI forms are driven entirely by annotated type schemas. Define your form structure, field types, labels, validation, and layout in a single `.as` file — the Vue components handle the rest.

## Core Concepts

- **Schema-first** — the `.as` file is the single source of truth for form structure
- **Annotations** — `@meta.*`, `@ui.*`, and `@expect.*` annotations control every aspect of the form
- **Reactive** — `useForm()` returns reactive `formData` that stays in sync with user input
- **Pluggable** — swap out field components by mapping types to your own UI library

## Annotations at a Glance

| Annotation          | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `@meta.label`       | Field label text                                    |
| `@meta.required`    | Mark field as required with error message           |
| `@meta.description` | Help text / description                             |
| `@meta.default`     | Default value                                       |
| `@ui.type`          | Field input type (`text`, `number`, `select`, etc.) |
| `@ui.placeholder`   | Placeholder text                                    |
| `@ui.order`         | Field display order                                 |
| `@ui.hidden`        | Hide the field                                      |
| `@ui.disabled`      | Disable the field                                   |
| `@ui.validate`      | Custom validation function                          |
| `@expect.min`       | Minimum numeric value                               |
| `@expect.max`       | Maximum numeric value                               |
| `@expect.minLength` | Minimum string length                               |
| `@expect.maxLength` | Maximum string length                               |
