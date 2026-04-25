# Styling

Styles for `@atscript/vue-form`, `@atscript/vue-table`, and `@atscript/vue-wf` ship in a single shared package: **`@atscript/ui-styles`**. It bundles the UnoCSS preset, the per-component class safelist, an `unplugin-vue-components` resolver, a baked-in default icon set, and pre-built CSS for non-UnoCSS apps.

## Install

```bash
pnpm add @atscript/vue-form @atscript/vue-table @atscript/vue-wf @atscript/ui-styles
# UnoCSS path also needs:
pnpm add -D unocss
# AsResolver path also needs:
pnpm add -D unplugin-vue-components
```

You only need to install the `@atscript/vue-*` packages whose components you actually use.

## What you can import

Every `@atscript/vue-*` package exposes two categories of components:

| Category                | What it is                                                                                                                                                                                                         | Auto-import via `AsResolver` |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------: |
| **Primary components**  | The ones you write as tags in templates: `<AsForm>`, `<AsField>`, `<AsIterator>`, `<AsTable>`, `<AsTableRoot>`, `<AsFilters>`, `<AsWfForm>`.                                                                       | ✓                            |
| **Default components**  | Out-of-the-box implementations you can swap via `:types` / `:components` props: `AsInput`, `AsSelect`, `AsRadio`, `AsCheckbox`, `AsParagraph`, `AsAction`, `AsObject`, `AsArray`, `AsUnion`, `AsTuple`, `AsRef`, `AsTableHeaderCell`, `AsTableCellValue`, `AsColumnMenu`, `AsFilterField`, `AsFilterInput`, `AsFilterDialog`, `AsConfigDialog`. You usually consume them through `createDefaultTypes()` / `createDefaultTableComponents()`, but they're also importable on their own when you want to wrap or extend a default. | ✗ (explicit imports)         |

Both categories support **two import patterns**:

### Barrel import (recommended for most cases)

Pull from the package root. Tree-shaking removes anything you don't reference.

```ts
// Primary components — write them as tags in templates
import { AsForm, AsField, AsIterator } from "@atscript/vue-form";
import { AsTable, AsTableRoot, AsFilters } from "@atscript/vue-table";
import { AsWfForm } from "@atscript/vue-wf";

// Default components — when you want to wrap or compose a built-in
import { AsInput, AsSelect } from "@atscript/vue-form";
import { AsFilterDialog, AsTableHeaderCell } from "@atscript/vue-table";

// Helpers that wire up all the defaults at once
import { createDefaultTypes } from "@atscript/vue-form";
import { createDefaultTableComponents } from "@atscript/vue-table";
```

### Subpath import (for fine-grained code-splitting)

Each component has its own per-component bundle. Useful when a route renders only one or two components and you want the smallest possible chunk.

```ts
import AsForm from "@atscript/vue-form/as-form";
import AsTableRoot from "@atscript/vue-table/as-table-root";
import AsInput from "@atscript/vue-form/as-input"; // default — same path style
```

::: tip Why aren't defaults auto-imported?
The auto-resolver covers primary components only — the ones you naturally tag in templates. Defaults are usually wired up through prop maps (`:types`, `:components`) rather than tagged directly, so the resolver intentionally skips them. When you do want to use a default explicitly (to wrap or extend it), write the `import` yourself.
:::

## Pick your styling path

There are three styling paths. They're orthogonal — pick what fits your stack:

| Path              | When to use                                                                               | Theming | `excludeComponents` | `iconOverrides` |
| ----------------- | ----------------------------------------------------------------------------------------- | ------- | ------------------- | --------------- |
| **UnoCSS preset** | You already use UnoCSS, or you want to customize the theme. **Recommended.**              | Yes     | Yes                 | Yes             |
| **Pre-built CSS** | Drop-in for apps that don't run UnoCSS. Fastest to wire up.                               | No      | No                  | No              |
| **`AsResolver`**  | Auto-import `<AsForm />` etc. without writing `import` lines. Pairs with either CSS path. | n/a     | n/a                 | n/a             |

## UnoCSS path — recommended

Add the preset to your `uno.config.ts`. **Pass `asPresetVunor(...)` directly** — never wrap it in a second array.

```ts
// uno.config.ts
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  // ✓ correct — `asPresetVunor` already returns Preset[]
  presets: asPresetVunor({
    // Optional theme overrides:
    baseRadius: "8px",
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});

// ✗ wrong — double-wrapping. UnoCSS may flatten silently, or break.
// presets: [asPresetVunor({})],
```

The preset registers a custom **Extractor** that scans your own source files for atscript-ui component imports / tags / helper calls and pulls in pre-computed class lists. You don't need to add `node_modules` to `content.filesystem`.

### Theme customization

`asPresetVunor()` forwards options to vunor's `presetVunor`. The most-used options:

- `baseRadius` — default `8px`. Drives `rounded-base` and the `r0..r4` ladder.

For deeper theming (palette, fingertip, custom presets) see the [vunor skill](https://github.com/maxim-mazurok/vunor) or its README — atscript-ui re-uses vunor's primitives and palette generator.

### Customizing icons

Atscript UI ships a sealed set of icons under the `as` collection — written as `i-as-search`, `i-as-close`, `i-as-loading`, etc. The icon set is **baked into the package at our publish time**: no Iconify API calls, no filesystem access, no `.icons/` folder spawned in your project at build time.

You can introspect the shipped names by importing the read-only map:

```ts
import { bakedIcons } from "@atscript/ui-styles";
console.log(Object.keys(bakedIcons)); // ['arrow-down', 'arrow-up', 'check', 'close', ...]
```

#### Override one of our built-in icons

Pass `iconOverrides` to swap any baked SVG with your own. Keys are the semantic names; values are full `<svg>...</svg>` strings.

```ts
// uno.config.ts
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor({
    iconOverrides: {
      // Replace our default `i-as-search` with a hand-rolled SVG
      search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M..."/></svg>',
    },
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

You can copy SVGs from any source (Iconify, your own designer, etc.). Use `currentColor` for fills/strokes so the icon inherits the surrounding text color via vunor's scope/layer system.

#### Add brand-new icons

For completely new icons (your own brand glyphs, an additional Iconify collection, etc.), compose your own `presetIcons` next to ours under a different collection prefix:

```ts
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";
import presetIcons from "@unocss/preset-icons";

export default defineConfig({
  presets: [
    ...asPresetVunor(),
    presetIcons({
      collections: {
        // From the official Iconify package — install with `pnpm add -D @iconify-json/lucide`
        lucide: () => import("@iconify-json/lucide/icons.json").then((i) => i.default),
        // Or your own custom collection
        mybrand: {
          logo: '<svg ...></svg>',
        },
      },
    }),
  ],
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

Now `i-lucide-search` and `i-mybrand-logo` work alongside our `i-as-*` set — no collisions, no coordination.

::: tip Why doesn't `iconOverrides` accept Iconify ids?
Our package can't fetch new icons at your build time (the loader is internal-only). To swap one of our icons for an Iconify icon, either copy the SVG inline into `iconOverrides`, or install your own `presetIcons` collection (as shown above) and use that prefix in your templates.
:::

### Power-user opt-out: `excludeComponents`

If you replace a built-in default with your own component, the default's classes still ship by default. Drop them with `excludeComponents`:

```ts
presets: asPresetVunor({
  excludeComponents: ["as-filter-dialog", "as-config-dialog"],
});
```

Names are kebab-case (`as-form`, `as-filter-dialog`, …). The exclusion is **post-match** — if you later render `<AsFilterDialog />` after excluding it, you'll get an unstyled component. That's an explicit choice on your side.

::: warning Footgun: partial customization of helper output
The most common customization pattern is "spread the defaults, override one":

```ts
const types = {
  ...createDefaultTableComponents(),
  filterDialog: MyFilterDialog, // override at runtime
};
```

This is fine at runtime — your `MyFilterDialog` renders. **But the extractor still pulls in classes for `as-filter-dialog`** because the literal string `createDefaultTableComponents(` is in your source. To actually drop those styles from the bundle, add `excludeComponents: ["as-filter-dialog"]` to your `asPresetVunor` config.

The runtime override and the build-time class extraction operate independently.
:::

## Pre-built CSS path

For apps without UnoCSS, import a pre-baked stylesheet at the entry of your app:

```ts
// app entry — load everything at once (recommended if you use more than one package)
import "@atscript/ui-styles/css/all";

// or per-package — only when you really only use one of them
// import "@atscript/ui-styles/css/form";
// import "@atscript/ui-styles/css/table";
// import "@atscript/ui-styles/css/wf";
```

::: warning
The pre-built CSS uses the **default theme + default icon set** and is fully sealed. `excludeComponents` and `iconOverrides` are **not honored** — these files are baked once at our publish time.

The per-package files (`form.css`, `table.css`, `wf.css`) are **independently complete**, which means they overlap on shared shortcuts. **Don't combine them.** Load `all.css` if you use components from more than one package.

For theming, custom icons, or excluding components, switch to the UnoCSS path.
:::

## `AsResolver` — auto-import

If you use [`unplugin-vue-components`](https://github.com/unplugin/unplugin-vue-components) for tag auto-import, drop `AsResolver()` into your resolver list:

```ts
// vite.config.ts
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default {
  plugins: [
    Components({
      resolvers: [AsResolver()],
    }),
  ],
};
```

After that you can write `<AsForm />`, `<AsTable />`, `<AsWfForm />` etc. in templates with no manual `import` line — they're routed to the matching `@atscript/vue-{form,table,wf}/<as-name>` subpath.

::: tip Primary components only
The resolver auto-imports the **primary user-tagged components** (`AsForm`, `AsField`, `AsIterator`, `AsTable`, `AsTableRoot`, `AsFilters`, `AsWfForm`).

**Default components** (`AsInput`, `AsSelect`, `AsFilterDialog`, etc.) are **not** auto-imported by design — they're swap targets you compose via `:types` / `:components` props or wrap explicitly. When you do want one, write the import yourself:

```ts
import { AsInput } from "@atscript/vue-form";
// or, equivalently:
import AsInput from "@atscript/vue-form/as-input";
```

**Composables** (`useTable`, `useFormState`, …) aren't components and must always be imported explicitly:

```ts
import { useTable } from "@atscript/vue-table";
```

:::

## Manual safelist (advanced)

If you want full control over which classes ship — e.g., you build a constrained micro-frontend and only render two components — bypass the extractor:

```ts
import { getComponentClasses, asPresetVunor } from "@atscript/ui-styles";

export default defineConfig({
  presets: asPresetVunor({}),
  safelist: getComponentClasses("as-form", "as-input", "as-select"),
});
```

`getComponentClasses(...kebabNames)` returns the deduped class list. `getHelperClasses(...helperNames)` does the same for helper aliases (`createDefaultTypes`, `createDefaultTableComponents`).

## Cheat sheet

```ts
// uno.config.ts — UnoCSS path
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { defineConfig } from "unocss";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor({
    baseRadius: "8px",                                  // optional
    excludeComponents: ["as-filter-dialog"],            // optional — drop unused defaults
    iconOverrides: { search: "<svg>...</svg>" },        // optional — swap built-in icons
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

```ts
// app entry — pre-built CSS
import "@atscript/ui-styles/css/all";
```

```ts
// vite.config.ts — auto-import
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";
export default { plugins: [Components({ resolvers: [AsResolver()] })] };
```
