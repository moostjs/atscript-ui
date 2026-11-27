---
outline: deep
---

# Installation

A full reference for wiring atscript-ui into a Vue 3 + Vite project. The [Quick Start](./quick-start) gets you running in ten minutes; this page covers every knob.

## Pick your packages

You only need the packages whose components you actually render.

| Use case                       | Install                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Forms only                     | `@atscript/ui` `@atscript/ui-styles` `@atscript/vue-form`                                            |
| Forms + tables                 | `@atscript/ui` `@atscript/ui-table` `@atscript/ui-styles` `@atscript/vue-form` `@atscript/vue-table` |
| Forms + tables + workflows     | + `@atscript/vue-wf` on the client, `@atscript/moost-wf` on the server                               |
| Server-side preset persistence | + `@atscript/moost-ui-presets` on the server                                                         |
| Dynamic annotations            | + `@atscript/ui-fns` (opt-in: enables `@ui.fn.*` and `@ui.form.validate`)                            |

Every flavour also wants `vunor` (the internal shortcuts engine atscript-ui composes against), `unocss`, `unplugin-atscript`, `unplugin-vue-components`, and `@atscript/typescript` as dev deps:

```bash
pnpm add vunor
pnpm add -D unocss unplugin-atscript unplugin-vue-components @atscript/typescript
```

### Ecosystem versions

The packages peer on the ecosystem release they were built against. The ranges published by 0.1.164:

| Peer                                                                  | Range      |
| --------------------------------------------------------------------- | ---------- |
| `@atscript/core`, `@atscript/typescript` (and `unplugin-atscript`)    | `^0.2.4`   |
| `@atscript/db`, `@atscript/db-client`, `@atscript/moost-db`           | `^0.1.168` |
| `moost`, `@moostjs/event-http`, `@moostjs/event-wf` (server packages) | `^0.7.2`   |
| `@wooksjs/event-core`, `@wooksjs/event-wf` (`@atscript/moost-wf`)     | `^0.8.0`   |

Since 0.1.164 the packages' internal helpers are ordinary dependencies,
installed and upgraded with the package that needs them: `@atscript/ui-fns`
(of `@atscript/vue-form` and `@atscript/vue-aooth`), `@uniqu/core` (of
`@atscript/ui-table` and `@atscript/vue-table`) and `@uniqu/url` (of
`@atscript/ui-table`). A table app doesn't install `@uniqu/*` itself. Keep
`@atscript/ui-fns` in your own dependencies only when you import it
(`installDynamicResolver()`, `@atscript/ui-fns/plugin`), and then on the same
version as `@atscript/vue-form`. `@atscript/vue-form` lists
`@atscript/typescript` as a peer, the package your generated `.as` types come
from.

When upgrading from 0.1.190 or earlier (to 0.1.191):

- A pick writes a `@meta.readonly` fill target, such as the read-only text next to a code, and the compiler no longer warns about one. After a pick the form's patch carries that field like any value the app sets; a backend that computes it ignores or drops it. A `@db.column.derived` target is still skipped. See [fills](/forms/references#a-pick-fills-other-fields-ui-valuehelp-fill).

When upgrading from 0.1.189 or earlier (to 0.1.190):

- `getDefaultClientFactory()`, `getMetaEntry().client`, `sharedPresetsClient()` and `useTableContext().client` are typed `ClientLike<T>` (from `@atscript/db-client`, re-exported by `@atscript/ui`): the public members of `Client`, so a factory may return an object that does not extend the class. Code that annotates their result as `Client<T>` writes `ClientLike<T>`. Nothing changes at run time.
- `RelationInfo.direction` (`/meta` `relations[]`) gains `"store"` (`@db.rel.store`, `@atscript/db` 0.1.196+): a relation without a foreign key, to-one or to-many by `isArray`. Code that switches over `direction` adds a branch. Forms leave a store navigation out like any other, and `@ui.valueHelp` on one is a compile error.
- A reference pick validates the field, marks it touched and emits `change` at once, not on the next blur. See [references](/forms/references).
- `ValueHelpSearchOptions.select` adds fields to the ones a value-help search always reads, instead of replacing them. Pass only the extra fields you need.
- `as-ref-root` is a flex row (the input, then the `trailing` slot) instead of a block. Check style overrides that set `display` on it or on `as-ref-anchor`.
- `buildQuery({ columnPaths })` and the export read the `selectWith` fields of the `columnPaths` columns, not of the visible ones.
- A `select` / `radio` field with `@ui.valueHelp` and no options of its own lists the dictionary's values. It used to render an empty select.

When upgrading from 0.1.181 or earlier (to 0.1.182 — all additive, except the field-row note):

- `submit()` returns its outcome next to the `@submit` / `@error` it emits: `{ ok: true, data }` or `{ ok: false, errors }` — on an `<AsForm>` template ref, in the slot props and as `useAsForm().onSubmit()`. See [The outcome of `submit()`](/forms/validation#the-outcome-of-submit).
- Type an `<AsForm>` template ref with `AsFormExposed<typeof formData>` (`InstanceType<typeof AsForm>` does not compile: `<AsForm>` is generic). The `@error` payload is exported as `TAsFormError`, the submit outcome as `TAsFormSubmitResult`.
- `useAsForm({ types })` is optional: a form root that renders its own inputs leaves it out.
- With the UnoCSS preset, a flex utility (`flex-none`, `flex-auto`, …) on the direct child of a field row — a custom control's root, or a bare `<input>` / `<select>` / `<textarea>` — now wins over the row's fill (see below). Such a class used to have no effect there, so check controls that carry one. (With the [pre-built CSS](/styling/prebuilt-css) the outcome depends on the order in which your own CSS loads.)

When upgrading from 0.1.163 or earlier:

- Since 0.1.164 a lone root element in a field row (the default slot of `AsFieldShell`) fills the row (`flex: 1 1 0%; min-width: 0`); before, it kept its content width. To keep a control at its content width (a segmented switch, a toggle), put a flex utility on its root: `class="flex-none"` (with the UnoCSS preset, since 0.1.182). A min-width utility only sets how far the control may shrink. On 0.1.164 – 0.1.181 only an important utility (`!flex-none`) or a wrapper element around the control keeps it at content width.

When upgrading from 0.1.160 or earlier:

- Rebuild every package that ships generated `.as` code: modules generated by atscript 0.1.110 or earlier don't load with atscript 0.2.
- A numeric cookie `maxAge` is now in seconds (wooks 0.8) — drop any `* 1000` in workflow steps that set cookies.
- Workflow triggers: `allow` fails closed and is checked on resume too, and trigger refusals are `HttpError`s with a `code`. See [Server Authoring → App wiring](/workflows/server-authoring#app-wiring).

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
  plugins: [atscript(), UnoCSS(), vue(), Components({ resolvers: [AsResolver()] })],
});
```

::: warning SSR + native deps
If you SSR a moost-db / moost-wf server with native database drivers, mark them external. Example:

```ts
ssr: {
  external: ["@atscript/db", "@atscript/db-sqlite", "better-sqlite3"];
}
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
    // The full vunor presetVunor() theme is accepted flat here. Omitted
    // fields fall back to atscript-ui's baked defaults. See
    // /styling/theme for the full option list.
    baseRadius: "8px",
    palette: { colors: { primary: "#a855f7" } }, // keeps grey/neutral/error defaults
    // fingertip: { m: "36px" },
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

- Registers the vunor shortcuts engine atscript-ui depends on internally (scopes, layers, surfaces, `c8-*` clickables, `i8-*` inputs, fingertip-\* heights, spacing tokens `$xxs..$xxl`).
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

| Auto-imported (Tier 1)                                                                                                                               | NOT auto-imported (Tier 2)                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
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

::: warning Security
Both features compile annotation strings into runtime functions via `new Function`. Only enable on builds where every `.as` file is trusted (i.e. your own source tree, vetted dependencies). Do not feed user-authored schemas through the dynamic resolver without sandboxing.
:::

Skip it entirely — don't install the package, don't call the function — if you only use static annotations. The static resolver in `@atscript/ui` handles `@meta.*`, `@expect.*`, and literal-valued `@ui.*` without any runtime compilation.

## Locale providers (optional)

The components ship with English texts for their built-in affordances ("Add item", "Clear filters", "Yes" / "No", workflow error messages). Provide the user's locale at the root of your app:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provideAsLocale } from "@atscript/vue-form";
import { provideCellLocale } from "@atscript/vue-table";

// Built-in texts + form number/date formatting
provideAsLocale(() => prefs.value.language);
// Table cells: language + time zone
provideCellLocale(() => ({ language: prefs.value.language, timezone: prefs.value.timezone }));
</script>
```

Translating the texts: [Language & Translations](/guide/i18n). Number, currency and date formatting are covered in [Forms: Locale](/forms/locale).

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
