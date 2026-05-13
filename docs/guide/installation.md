---
outline: deep
---

# Installation

A full reference for wiring atscript-ui into a Vue 3 + Vite project. The [Quick Start](./quick-start) gets you running in ten minutes; this page covers every knob.

## Pick your packages

You only need the packages whose components you actually render.

| Use case                      | Install                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Forms only                    | `@atscript/ui` `@atscript/ui-styles` `@atscript/vue-form`                                                               |
| Forms + tables                | `@atscript/ui` `@atscript/ui-table` `@atscript/ui-styles` `@atscript/vue-form` `@atscript/vue-table`                    |
| Forms + tables + workflows    | + `@atscript/vue-wf` on the client, `@atscript/moost-wf` on the server                                                  |
| Server-side preset persistence | + `@atscript/moost-ui-presets` on the server                                                                            |
| Dynamic annotations           | + `@atscript/ui-fns` (opt-in: enables `@ui.fn.*` and `@ui.form.validate`)                                              |

Every flavour also wants `vunor`, `unocss`, `unplugin-atscript`, `unplugin-vue-components`, and `@atscript/typescript` as dev deps:

```bash
pnpm add vunor
pnpm add -D unocss unplugin-atscript unplugin-vue-components @atscript/typescript
```

## Vite configuration

The Vite config has four moving pieces:

1. **`unplugin-atscript/vite`** — compiles `.as` files (`.as.d.ts` + `.as.js`).
2. **`unocss/vite`** — runs the atscript-ui UnoCSS preset.
3. **`@vitejs/plugin-vue`** — the usual Vue plugin.
4. **`unplugin-vue-components/vite`** with `AsResolver()` — auto-imports `<AsForm>`, `<AsTable>`, etc.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import atscript from "unplugin-atscript/vite";
import UnoCSS from "unocss/vite";
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default defineConfig({
  plugins: [
    atscript(),
    UnoCSS(),
    vue(),
    Components({ resolvers: [AsResolver()] }),
  ],
});
```

::: warning SSR + native deps
If you SSR a moost-db / moost-wf server with native database drivers, mark them external. Example:

```ts
ssr: { external: ["@atscript/db", "@atscript/db-sqlite", "better-sqlite3"] }
```
:::

## UnoCSS configuration

`asPresetVunor()` returns a `Preset[]` you pass straight to `presets:`. **Do not wrap it in a second array** — UnoCSS will flatten silently and you'll get inconsistent class output.

```ts
// uno.config.ts
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  content: {
    filesystem: ["src/**/*.{vue,ts,tsx}"],
  },
  presets: asPresetVunor({
    // Theme overrides (all optional)
    baseRadius: "8px",
    // Drop classes for defaults you've swapped out (post-match exclusion)
    excludeComponents: ["as-filter-dialog"],
    // Override one of the baked icons by name
    iconOverrides: {
      search: '<svg viewBox="0 0 24 24"><path d="..." fill="currentColor"/></svg>',
    },
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

What the preset does:

- Registers vunor (the theme system: scopes, layers, surfaces, `c8-*` clickables, `i8-*` inputs, fingertip-* heights, spacing tokens `$xxs..$xxl`).
- Registers the `as-*` shortcut tree from `@atscript/ui-styles` (every component's styles live here, not in `.vue` templates).
- Registers a custom extractor that scans your sources for `<AsForm>` / `useForm` / `createDefaultTypes` / etc. and pulls in the matching pre-computed class lists. **You don't have to add `node_modules` to `content.filesystem`.**
- Bakes in an icon set under the `as` collection (`i-as-search`, `i-as-close`, `i-as-loading`, …).

For theme tuning, per-component safelist control, and pre-built CSS see [Styling](/styling/).

## `AsResolver` — auto-imports

`AsResolver()` from `@atscript/ui-styles/vite` plugs into `unplugin-vue-components` and routes every Tier-1 atscript-ui component to its per-component subpath.

```ts
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

Components({ resolvers: [AsResolver()] });
```

What auto-resolves:

| Auto-imported (Tier 1)                                                                                                                                | NOT auto-imported (Tier 2)                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `<AsForm>` `<AsField>` `<AsIterator>` `<AsTable>` `<AsTableRoot>` `<AsWindowTable>` `<AsTableActions>` `<AsFilters>` `<AsPresetPicker>` `<AsWfForm>` | Default field components (`AsInput`, `AsSelect`, `AsCheckbox`, …), default cells, default dialogs |

Tier-2 defaults are swap targets you compose through `:types` / `:components` prop maps, not template tags — so the resolver intentionally skips them. Composables (`useForm`, `useTable`, `useWfForm`) are not components and always need an explicit import. See [Styling: AsResolver](/styling/installation#asresolver-auto-import) for the full pattern.

## Atscript config

Create `atscript.config.js` (or `.ts`) at the project root so `asc` and `unplugin-atscript` can resolve the right plugins:

```js
// atscript.config.js
import ts from "@atscript/typescript";
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";

export default {
  plugins: [ts(), uiPlugin(), uiFnsPlugin()],
};
```

If you use atscript-db tables or workflow forms, add their plugins:

```js
import dbPlugin from "@atscript/db/plugin";
import wfPlugin from "@atscript/moost-wf/plugin";

export default {
  plugins: [ts(), dbPlugin(), uiPlugin(), uiFnsPlugin(), wfPlugin()],
};
```

Each plugin teaches the compiler about its annotation namespace (`@ui.*`, `@db.*`, `@wf.*`, `@ui.fn.*`). Skip a plugin and the compiler will reject those annotations as unknown. The full atscript-config reference is at [atscript.dev/packages/typescript](https://atscript.dev/packages/typescript).

## Dynamic resolver (opt-in)

`@atscript/ui-fns` enables two things on top of static annotations:

- **`@ui.fn.*`** — any `@ui.*` value can be expressed as a function-string that gets compiled to a live computed property. Lets you say "this field is hidden when `formData.value.kind === 'guest'`" or "this column's title depends on the row".
- **`@ui.form.validate`** — cross-field validators expressed as function-strings; run after per-field `@expect.*` checks.

Activate by calling once in your entry-client:

```ts
import { installDynamicResolver } from "@atscript/ui-fns";
installDynamicResolver();
```

Or as a side-effect import:

```ts
import "@atscript/ui-fns/install";
```

::: warning Security
Both features compile annotation strings into runtime functions via `new Function`. Only enable on builds where every `.as` file is trusted (i.e. your own source tree, vetted dependencies). Do not feed user-authored schemas through the dynamic resolver without sandboxing.
:::

Skip it entirely — don't install the package, don't call the function — if you only use static annotations. The static resolver in `@atscript/ui` handles `@meta.*`, `@expect.*`, and literal-valued `@ui.*` without any runtime compilation.

## Locale providers (optional)

The default field components ship with English labels for built-in affordances (placeholder hints, "Required", "Add row", "Show filters", error formatting). Override them at the root of your app:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provideAsLocale } from "@atscript/vue-form";
import { provideCellLocale } from "@atscript/vue-table";

provideAsLocale({
  required: "Обязательно",
  addRow: "Добавить",
});

provideCellLocale({
  noData: "Нет данных",
  rowsPerPage: "Строк на странице",
});
</script>
```

Both providers are shallow — pass only the keys you want to override. The forms locale ships from `@atscript/vue-form`, the cell/table locale from `@atscript/vue-table`. Their full key lists are at [Forms: Locale](/forms/locale).

## Pre-built CSS without UnoCSS

If your app doesn't run UnoCSS at all, import a pre-baked stylesheet at the entry:

```ts
import "@atscript/ui-styles/css/all";
```

Per-package files (`form.css`, `table.css`, `wf.css`) exist too but **don't combine them** — they overlap on shared shortcuts. Use `all.css` for any multi-package consumer. The pre-built CSS uses the default theme + default icons; for theme tuning or icon overrides, switch back to the UnoCSS path. Full details at [Styling: Pre-built CSS](/styling/prebuilt-css).

## What's next

- [The `.as` file](./the-as-file) — annotation families you'll use here.
- [Forms](/forms/) — components, validation, custom field types.
- [Tables](/tables/) — query function, filtering, sorters, presets.
- [Styling](/styling/) — theme, icons, pre-built CSS, shortcut tree.
