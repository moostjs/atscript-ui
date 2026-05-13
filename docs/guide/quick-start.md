---
outline: deep
---

# Quick Start

Build a working form and a working table from `.as` schemas in about ten minutes. By the end you'll have:

- A Vue 3 + Vite app with `unplugin-atscript`, UnoCSS, and `AsResolver` wired up.
- A `Contact.as` schema rendering as `<AsForm>` with labels, validation, and a submit button.
- A `Product.as` schema rendering as `<AsTable>` against a `moost-db` REST endpoint with filtering, sort, and pagination.

::: info Prerequisites
This guide assumes you already have a Vue 3 + Vite project and you're comfortable installing the atscript toolchain. If `asc` and `.as.d.ts` are new concepts, run through the [atscript Quick Start](https://atscript.dev/packages/typescript/quick-start) first — it takes five minutes and explains the compilation model that drives every page below.
:::

## 1. Install

```bash
pnpm add @atscript/ui @atscript/ui-styles @atscript/vue-form @atscript/vue-table vunor
pnpm add -D @atscript/typescript @atscript/ui-fns unplugin-atscript unplugin-vue-components unocss
```

What each package does:

- **`@atscript/ui`** — framework-agnostic core (FieldResolver, FormDef, TableDef, validators).
- **`@atscript/ui-styles`** — UnoCSS preset, `AsResolver`, baked icon set.
- **`@atscript/vue-form` / `@atscript/vue-table`** — Vue 3 components.
- **`vunor`** — the internal shortcuts/styling engine atscript-ui composes its `as-*` classes on top of.
- **`@atscript/typescript`** + **`unplugin-atscript`** — compile `.as` files to `.as.d.ts` and `.as.js` (the bundler does this in-memory at dev time).
- **`@atscript/ui-fns`** — opt-in dynamic resolver (we'll use it for `@ui.fn.*` and `@ui.form.validate`).
- **`unplugin-vue-components`** — auto-imports `<AsForm>` / `<AsTable>` etc. via `AsResolver()`.

## 2. Configure atscript

Create `atscript.config.js` at the project root. Register the TypeScript plugin (so `.as` codegen runs) plus the `ui` plugin (so `@ui.*` annotation keys are recognised by the compiler):

```js
// atscript.config.js
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";

export default {
  plugins: [ts(), uiPlugin(), uiFnsPlugin()],
};
```

If you'll also use [atscript-db](https://db.atscript.dev) tables or workflow forms, add `dbPlugin()` and `wfPlugin()` here.

## 3. Wire up Vite

The Vite config does three things: compile `.as` files (`unplugin-atscript`), auto-import primary atscript-ui components (`AsResolver`), and process UnoCSS (`UnoCSS`).

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import atscript from "unplugin-atscript/vite";
import UnoCSS from "unocss/vite";
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default defineConfig({
  plugins: [atscript(), UnoCSS(), vue(), Components({ resolvers: [AsResolver()] })],
});
```

`AsResolver()` only auto-imports Tier-1 components — the ones you write as tags: `<AsForm>`, `<AsField>`, `<AsIterator>`, `<AsTable>`, `<AsTableRoot>`, `<AsWindowTable>`, `<AsFilters>`, `<AsPresetPicker>`, `<AsWfForm>`. Default field components (`AsInput`, `AsSelect`, …) and composables (`useForm`, `useTable`, …) are always explicit imports — see [Installation](./installation#dynamic-resolver-opt-in) for the rationale.

## 4. Wire up UnoCSS

Add `asPresetVunor()` to `uno.config.ts`:

```ts
// uno.config.ts
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  content: {
    filesystem: ["src/**/*.{vue,ts,tsx}"],
  },
  presets: asPresetVunor(),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

`asPresetVunor()` returns a `Preset[]` — **do not wrap it in another array**. The preset bundles the vunor shortcuts engine + an extractor that scans your sources for atscript-ui imports and pulls in the matching per-component class lists from the safelist. See [Styling](/styling/installation) for theme tuning, icon overrides, and `excludeComponents`.

## 5. App entry

```ts
// src/main.ts
import { createApp } from "vue";
import { installDynamicResolver } from "@atscript/ui-fns";
import App from "./App.vue";
import "@unocss/reset/tailwind.css";
import "virtual:uno.css";

installDynamicResolver();
createApp(App).mount("#app");
```

::: warning installDynamicResolver
`installDynamicResolver()` activates `@ui.fn.*` and `@ui.form.validate` — both compile annotation strings into runtime functions via `new Function`. Only call it if you trust every `.as` file in your build. Skip the call (and the import) if you only use static annotations.
:::

## 6. Your first form

Create `src/forms/contact.as`:

```atscript
@meta.label 'Contact'
@ui.form.submit.text 'Send'
export interface Contact {
    @meta.label 'Name'
    @ui.form.placeholder 'Jane Doe'
    @meta.required 'Name is required'
    @ui.form.order 1
    name: string

    @meta.label 'Email'
    @ui.form.placeholder 'jane@example.com'
    @meta.required 'Email is required'
    @ui.form.order 2
    email: string.email

    @meta.label 'Message'
    @ui.type 'textarea'
    @expect.minLength 10, 'At least 10 characters'
    @ui.form.order 3
    message: string
}
```

Render it:

```vue
<!-- src/views/Contact.vue -->
<script setup lang="ts">
import { useForm } from "@atscript/vue-form";
import { Contact } from "../forms/contact.as";

const { def, formData, validate } = useForm(Contact);

function onSubmit() {
  if (!validate()) return;
  console.log("Submitted:", formData.value);
}
</script>

<template>
  <AsForm :def="def" :form-data="formData" @submit="onSubmit" />
</template>
```

What you get out of the box:

- Labels and placeholders from `@meta.label` / `@ui.form.placeholder`.
- Required + length validation from `@meta.required` / `@expect.minLength`.
- A textarea instead of a single-line input on `message` because `@ui.type 'textarea'`.
- A submit button labeled `Send` (from `@ui.form.submit.text`).
- Field ordering from `@ui.form.order`.

::: details Where to look next for more form patterns
The full forms guide at [/forms/](/forms/) covers arrays, nested objects, unions, refs, dynamic fields, and validation with runnable examples.
:::

## 7. Your first table

Annotate a `.as` schema. If you're using [atscript-db](https://db.atscript.dev) the same file doubles as your DB table; otherwise omit the `@db.*` lines.

```atscript
// src/schemas/Product.as
@db.table 'products'
export interface Product {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @db.index.fulltext 'products_search'
    name: string

    @meta.label 'SKU'
    @db.index.unique 'products_sku_idx'
    sku: string

    @meta.label 'Price'
    @db.amount.currency 'USD'
    @db.column.precision 10, 2
    @db.index.plain 'products_price_idx'
    price: decimal

    @meta.label 'Tags'
    tags: string[]

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp
}
```

Render the table. `<AsTableRoot>` owns query state (filters, sort, pagination); `<AsTable>` renders the rows:

```vue
<!-- src/views/Products.vue -->
<script setup lang="ts">
import { Product } from "../schemas/Product.as";
</script>

<template>
  <AsTableRoot :type="Product" url="/api/products">
    <AsFilters />
    <AsTable />
  </AsTableRoot>
</template>
```

What this does:

- `AsTableRoot` derives a `TableDef` from `Product`. Every annotated field becomes a column candidate.
- `AsFilters` renders inline filter chips. The filter input for each field is inferred from its type — string → text, number → range, enum → multi-select.
- `AsTable` renders the body. Sort is one click on the header; the page bar at the bottom is automatic.
- The `url="/api/products"` is a [`moost-db`](https://db.atscript.dev/http/) REST endpoint. The table writes its filter/sort/page state as a [Uniquery](https://db.atscript.dev) query string and reads `{ data, total }` back.

::: tip Don't have a server yet?
You can also pass a `:query` function — any `(params) => Promise<{ data, total }>` works. See [Query function](/tables/query-function) for the contract.
:::

## 8. Build the schemas

When you change a `.as` file at dev time, `unplugin-atscript` regenerates the runtime descriptor in-memory and HMR picks it up. For production builds, run `asc` to emit `.as.d.ts` files alongside your sources so TypeScript can resolve the imports:

```bash
npx asc
```

You only need to run this when types change. The vite plugin handles the rest.

## What's next

- [The `.as` file](./the-as-file) — the five annotation families (`@meta.*`, `@expect.*`, `@ui.*`, `@db.*`, `@wf.*`) and how they compose.
- [Forms](/forms/) — field types, arrays, nested objects, unions, dynamic fields, custom components.
- [Tables](/tables/) — filtering, sorting, custom cells, presets, URL state, value-help.
- [Workflows](/workflows/) — multi-step HTTP forms with server-driven state.
- [Styling](/styling/) — theme, icons, pre-built CSS, `as-*` shortcuts.
