---
outline: deep
---

# Ecosystem Map

atscript-ui sits inside a three-site family. They share one source-of-truth (the `.as` file) and split responsibility by layer: language at the bottom, database in the middle, UI on top.

## The three sibling sites

| Site                                           | What it covers                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [**atscript.dev**](https://atscript.dev)       | The `.as` language: `@meta.*`, `@expect.*`, primitives, `asc` codegen, `unplugin-atscript`, the `Validator`, JSON Schema export, VSCode LSP, plugin authoring.                 |
| [**db.atscript.dev**](https://db.atscript.dev) | The DB layer: `@db.*` annotations, adapters (sqlite / postgres / mysql / mongo), `DbSpace`, `BaseDbAdapter`, schema sync, relations, queries, `moost-db` REST, browser Client. |
| **ui.atscript.dev** (this site)                | The UI layer: forms, tables, workflows, styling. The `@ui.*` and `@wf.*` annotation families. Vue 3 today; framework-agnostic core ready for React / Solid bindings tomorrow.  |

The boundary is clean — atscript doesn't know about HTTP, atscript-db doesn't know about Vue, atscript-ui doesn't know about your SQL dialect. A `.as` file flows through all three.

## Package dependency graph

```
@atscript/ui                ← framework-agnostic core: FormDef, TableDef,
  │                          annotation keys, FieldResolver, validators
  │
  ├─ @atscript/ui-fns       ← opt-in: dynamic @ui.fn.* computed props
  │                          (uses new Function)
  │
  ├─ @atscript/ui-table     ← framework-agnostic: filter model,
  │                          filter→Uniquery, presets
  │
  ├─ @atscript/ui-styles    ← shared UnoCSS preset + as-* shortcuts +
  │                          icons + AsResolver (consumed by every vue-* pkg)
  │
  ├─ @atscript/vue-form     ← Vue 3 form components + composables
  │
  ├─ @atscript/vue-table    ← Vue 3 table components + composables
  │                          (depends on ui-table)
  │
  ├─ @atscript/vue-wf       ← Vue 3 workflow form: HTTP round-trip loop
  │                          driven by atscript metadata
  │
  ├─ @atscript/moost-wf     ← Moost server-side workflow:
  │                          decorators, interceptors, AsWfStore
  │
  └─ @atscript/moost-ui-presets ← Moost controller + atscript schema
                              for table-preset persistence
```

External deps each package leans on:

- All client packages depend on Vue 3 and consume `@atscript/ui-styles`.
- `vue-wf` and `vue-table` also consume `@atscript/vue-form` (the form is how steps and value-help dialogs render).
- `moost-wf` and `moost-ui-presets` depend on [Moost](https://moost.org/) and live alongside any server adapter you already use.
- `vue-table`'s URL data path expects a [`moost-db`](https://db.atscript.dev/http/) compatible endpoint. Any `(params) => { data, total }` function works as an alternative — see [Tables: Query function](/tables/query-function).

## When to use which package

| I want…                                               | Install                                                                                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Just forms (no tables, no workflows)                  | `@atscript/ui` `@atscript/ui-styles` `@atscript/vue-form`                                                                                                              |
| Forms + tables                                        | + `@atscript/ui-table` `@atscript/vue-table`                                                                                                                           |
| Forms + tables + HTTP workflows                       | + `@atscript/vue-wf` (client), `@atscript/moost-wf` (server)                                                                                                           |
| Server-side preset persistence (saved-views per user) | + `@atscript/moost-ui-presets`                                                                                                                                         |
| Dynamic, schema-defined computed props (`@ui.fn.*`)   | + `@atscript/ui-fns` (and call `installDynamicResolver()`)                                                                                                             |
| My own framework binding (React / Solid / Svelte)     | Port from `@atscript/ui` + `@atscript/ui-table`. Re-use `@atscript/ui-styles`' pre-built CSS (`@atscript/ui-styles/css/all`) or the UnoCSS preset.                     |
| To author a new annotation namespace                  | Read the plugin guide on [atscript.dev](https://atscript.dev). atscript-ui's plugins (`@atscript/ui/plugin`, `@atscript/ui-fns/plugin`) are reference implementations. |

The Vue split (`vue-form` / `vue-table` / `vue-wf`) intentionally mirrors the agnostic split (`ui` / `ui-table`). Every reactive primitive, default component, and resolver wrapper in a `vue-*` package has a corresponding pure-TS piece in the agnostic core. That's what makes the React / Solid port path realistic.

## Glossary

A one-line definition of every term that recurs in the docs. Click through for the full API.

- **FormDef** — the materialised form descriptor a `useForm()` call returns. Fields, validators, layout, submit action, all resolved from `.as` metadata. [API](/api/ui).
- **TableDef** — the materialised table descriptor `<AsTableRoot>` builds. Columns, filterable fields, sortable fields, default sort, value-help wiring. [API](/api/ui).
- **FieldResolver** — the indirection layer between annotations and rendered components. Reads `@ui.*` from the `.as` runtime descriptor; `ui-fns` swaps in a dynamic version that also evaluates `@ui.fn.*`. [API](/api/ui).
- **FilterCondition** — a single applied filter (`{ field, op, value }`). Mutated by filter chips / dialogs. [API](/api/ui-table).
- **FieldFilters** — the _display_ list of which filter inputs are visible. Independent of which filters are applied. [API](/api/ui-table).
- **PresetSnapshot** — a frozen `{ filters, sorters, columns, search, pagination }` blob users save as a "saved view". Persisted by `moost-ui-presets`. [API](/api/ui-table).
- **TFnScope** — the `{ formData, row, def, locale }` object `@ui.fn.*` function-strings run inside. [API](/api/ui-fns).
- **AsWfStore** — server-side workflow state container. Tracks current step, persisted form data, context, outlets. [API](/api/moost-wf).
- **`@InputForm` / `@OutputForm`** — Moost decorators on a workflow handler. The atscript types they reference are what `<AsWfForm>` renders. [API](/api/moost-wf).
- **AsResolver** — the `unplugin-vue-components` resolver that auto-imports Tier-1 atscript-ui components. Shipped from `@atscript/ui-styles/vite`. [API](/api/ui-styles).
- **`asPresetVunor`** — the UnoCSS preset that wires up the vunor shortcuts engine + the `as-*` shortcut tree + the baked icon set. [Styling](/styling/).
- **Uniquery** — the URL-encoded query format `moost-db` understands. `<AsTableRoot>` serialises filter/sort/page state into it. [db.atscript.dev](https://db.atscript.dev).

## What's next

- [Quick Start](./quick-start) — wire up Vite and render your first form + table.
- [The `.as` file](./the-as-file) — the five annotation families.
- [Forms](/forms/) — components and patterns.
- [Tables](/tables/) — query, filter, sort, presets.
- [Workflows](/workflows/) — multi-step HTTP forms.
