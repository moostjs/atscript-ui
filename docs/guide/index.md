# Overview

Atscript UI is a type-driven UI toolkit that generates forms and tables from [Atscript](https://atscript.dev) annotated types.

## How it works

1. **Define your schema** — write an `.as` file with fields, labels, validation, and UI hints
2. **Import and render** — use `useForm()` and `<AsForm>` in your Vue component
3. **Customize** — map field types to your own UI components

## Packages

| Package              | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `@atscript/ui-core`  | Framework-agnostic runtime for form and table definitions |
| `@atscript/ui-fns`   | Dynamic fn-compiled field properties (opt-in)             |
| `@atscript/vue-form` | Vue 3 form components with `as-` prefix                   |

## Requirements

- Node.js >= 22.12.0
- Vue 3
- `@atscript/typescript` for compiling `.as` schemas
