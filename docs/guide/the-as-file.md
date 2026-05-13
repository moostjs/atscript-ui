---
outline: deep
---

# The `.as` File

A `.as` file is the single source of truth in the atscript ecosystem: types, validation rules, UI configuration, database schema, and workflow metadata all live next to each other on the same interface. Everything atscript-ui renders is read out of these files.

This page is a primer for the annotation families you'll touch most when building UIs. The full language reference is at [atscript.dev](https://atscript.dev).

## What is a `.as` file?

`.as` is the atscript file extension. The language is a strict subset of TypeScript-style type declarations (`interface`, `type`, primitives, unions, arrays, tuples) annotated with `@*.*` decorators that carry metadata.

When you save a `.as` file, the compiler (`asc` from the CLI, or `unplugin-atscript` from a bundler) emits two artefacts next to it:

- **`<name>.as.d.ts`** — pure TypeScript types. Importing from `.as` resolves through these in the IDE.
- **`<name>.as.js`** — runtime field descriptors. This is the object atscript-ui's `FieldResolver` reads to know which UI to render, which validators to run, what the label says, which database table backs it, etc.

```text
contact.as
   │
   │  asc / unplugin-atscript
   ▼
contact.as.d.ts   ← TypeScript sees this when you `import { Contact } from './contact.as'`
contact.as.js     ← Vue components read this at runtime via the FieldResolver
```

You import from `'./contact.as'` and both halves are wired up. See the [atscript Build Setup guide](https://atscript.dev/packages/typescript/build-setup) for the full compilation model.

## The five annotation families

`.as` annotations are namespaced by family. The compiler plugins you register in `atscript.config.js` decide which namespaces are valid. For atscript-ui you'll use five.

### `@meta.*` — atscript core

The portable, framework-agnostic metadata. Every atscript-aware tool understands these.

| Key                  | Purpose                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `@meta.label`        | Human-readable label for a type or field.                                |
| `@meta.description`  | Long-form description (used as form hint / column tooltip).              |
| `@meta.required`     | Mark a field as required, with the error message as the argument.       |
| `@meta.default`      | Static default value (typed as a string literal; coerced at runtime).   |
| `@meta.id`           | Mark the primary-id field of a record.                                   |
| `@meta.readonly`     | Field is read-only at the metadata level (forms render disabled).       |
| `@meta.sensitive`    | Field should be redacted in logs / dev tools.                            |

Full reference: [atscript.dev/api/meta](https://atscript.dev).

### `@expect.*` — atscript core

Validation rules. Run by the `Validator` in `@atscript/ui` and reused server-side by [`@atscript/moost-validator`](https://atscript.dev).

| Key                                | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `@expect.minLength n, 'msg'`       | Minimum string / array length.                   |
| `@expect.maxLength n, 'msg'`       | Maximum string / array length.                   |
| `@expect.min n, 'msg'`             | Minimum numeric value.                           |
| `@expect.max n, 'msg'`             | Maximum numeric value.                           |
| `@expect.pattern '/re/', 'msg'`    | Regex pattern.                                   |
| `@expect.email 'msg'`              | Email format.                                    |
| `@expect.url 'msg'`                | URL format.                                      |

Full list: [atscript.dev](https://atscript.dev).

### `@ui.*` — this repo

UI-specific configuration. The `@atscript/ui/plugin` registers the namespace; every component in atscript-ui reads its values through the `FieldResolver`.

Three sub-namespaces show up most:

| Sub-namespace      | Used by                       | Common keys                                                                 |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------- |
| `@ui.form.*`       | `<AsForm>`, `<AsField>`       | `placeholder`, `hint`, `order`, `hidden`, `disabled`, `grid.colSpan`, `submit.text`, `label.singular` |
| `@ui.table.*`      | `<AsTable>`, `<AsFilters>`    | `hidden`, `order`, `width`, `align`, `cell`, `headerCell`                   |
| `@ui.type`         | both                          | The UI type id: `text`, `password`, `number`, `textarea`, `select`, `radio`, `checkbox`, … |
| `@ui.fn.*`         | both (with `ui-fns` installed) | Dynamic computed properties: function-string body that reads `{ formData, row, … }`. |

The full list per-component lives in the [Forms annotations](/forms/annotations) and [Tables annotations](/tables/annotations) guides.

### `@db.*` — atscript-db

Database semantics. The `dbPlugin()` registers the namespace; `DbSpace` and `moost-db` read these. atscript-ui doesn't read `@db.*` directly, but the same `.as` file is what your form / table renders against.

| Key                            | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `@db.table 'name'`             | This interface backs a database table.                           |
| `@db.json`                     | Field is stored as a JSON column (nested objects, unions).      |
| `@db.index.fulltext 'idxName'` | Add field to a fulltext index.                                  |
| `@db.index.unique 'idxName'`   | Add field to a unique index.                                    |
| `@db.default.increment`        | Auto-increment (primary key).                                   |
| `@db.default.now`              | Default to "now" timestamp.                                     |
| `@db.default.uuid`             | Default to a UUID.                                              |
| `@db.rel.FK`                   | Foreign-key field (typed as `OtherTable.id`).                   |
| `@db.column.precision p, s`    | Decimal precision/scale.                                        |
| `@db.amount.currency 'USD'`    | Treat as currency.                                              |
| `@db.http.path '/api/things'`  | The REST path `moost-db` exposes this table at.                 |

Full reference: [db.atscript.dev](https://db.atscript.dev/api/tables).

### `@wf.*` — workflow forms

The `@atscript/moost-wf/plugin` registers this namespace. You'll use it when building HTTP workflows (see the [Workflows guide](/workflows/)).

| Key                          | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `@wf.context.pass`           | Pass this field's value to the next step via the workflow context. |
| `@wf.action.withData`        | The action submits with form data.                                 |
| `@wf.store.fromContext`      | Hydrate this field from the workflow's persisted store.            |

Full reference: [Workflows: Server authoring](/workflows/server-authoring).

## A complete annotated example

A realistic `.as` file uses all five families on one interface. This `Product.as` example is both the database table and the form/table schema:

```atscript
@db.table 'products'
@db.table.preferredId.uniqueIndex 'products_sku_idx'
@meta.label 'Product'
export interface ProductsTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @meta.required 'Name is required'
    @db.index.fulltext 'products_search'
    @ui.form.grid.colSpan 'half'
    @expect.maxLength 120, 'Keep it under 120 characters'
    name: string

    @meta.label 'SKU'
    @meta.required 'SKU is required'
    @db.index.unique 'products_sku_idx'
    @ui.form.grid.colSpan 'half'
    @expect.pattern '/^[A-Z0-9-]+$/', 'Uppercase letters, digits and dashes only'
    sku: string

    @meta.label 'Description'
    @ui.type 'textarea'
    @db.index.fulltext 'products_search'
    description?: string

    @meta.label 'Price'
    @db.amount.currency 'USD'
    @db.column.precision 10, 2
    @db.index.plain 'products_price_idx'
    @ui.form.grid.colSpan 'half'
    @expect.min 0, 'Price must be non-negative'
    price: decimal

    @meta.label 'Tags'
    @ui.form.label.singular 'tag'
    tags: string[]

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp
}
```

One file gives you:

- A SQLite/Postgres/MySQL `products` table with the right indexes (via [atscript-db](https://db.atscript.dev)).
- A REST endpoint at `/api/products` (via [`moost-db`](https://db.atscript.dev/http/)).
- A two-column form in atscript-ui (`name` and `sku` side-by-side via `@ui.form.grid.colSpan 'half'`, `description` full-width as a textarea).
- Validation that runs identically on the client (via `@atscript/ui`'s `Validator`) and on the server (via [`@atscript/moost-validator`](https://atscript.dev)).
- A table with sortable columns, automatic filter inputs (text on `name`/`sku`/`description`, range on `price`, multi-select chips on `tags`), and a default created-at column.

That's the payoff of the model: annotate once, render everywhere.

::: tip Run-able schemas
The dedicated guides below cover the same shapes in focused examples:
- [Forms](/forms/) — focused one-page form examples (arrays, nested, unions, refs, dynamic, validation).
- [Tables](/tables/) — filters, sorters, custom cells, presets, value-help.
:::

## Codegen quick reference

Two ways to compile `.as` files:

```bash
# CLI — emits .as.d.ts (and optionally .as.js) next to each .as file.
# Run on CI, before publishing a package, or whenever IDE types drift.
npx asc
```

```ts
// vite — compiles on the fly at dev time, regenerates on HMR.
import atscript from "unplugin-atscript/vite";

export default defineConfig({
  plugins: [atscript()],
});
```

In a typical dev workflow you only run `asc` manually when types stop resolving in the IDE (after pulling teammates' changes, for example) or when building for production CI. The plugin handles the rest.

Full atscript syntax + tooling reference: [atscript.dev](https://atscript.dev).

## What's next

- [Ecosystem map](./ecosystem) — how `.as` ties the three sibling sites (atscript / atscript-db / atscript-ui) together.
- [Forms: Annotations](/forms/annotations) — every `@ui.form.*` key.
- [Tables: Annotations](/tables/annotations) — every `@ui.table.*` key.
- [Workflows: Server authoring](/workflows/server-authoring) — `@wf.*` keys in context.
