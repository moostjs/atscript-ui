# Styling

Styles for `@atscript/vue-form`, `@atscript/vue-table`, and `@atscript/vue-wf` ship in a single shared package: **`@atscript/ui-styles`**. It bundles the UnoCSS preset, the per-component class safelist, an `unplugin-vue-components` resolver, and pre-built CSS for non-UnoCSS apps.

## Install

```bash
pnpm add @atscript/vue-form @atscript/vue-table @atscript/vue-wf @atscript/ui-styles
# UnoCSS path also needs:
pnpm add -D unocss
# AsResolver path also needs:
pnpm add -D unplugin-vue-components
```

You only need to install the `@atscript/vue-*` packages whose components you actually use.

## Pick your path

There are three paths. They're orthogonal — pick what fits your stack:

| Path              | When to use                                                                               | Theming | `excludeComponents` |
| ----------------- | ----------------------------------------------------------------------------------------- | ------- | ------------------- |
| **UnoCSS preset** | You already use UnoCSS, or you want to customize the theme. **Recommended.**              | Yes     | Yes                 |
| **Pre-built CSS** | Drop-in for apps that don't run UnoCSS. Fastest to wire up.                               | No      | No                  |
| **`AsResolver`**  | Auto-import `<AsForm />` etc. without writing `import` lines. Pairs with either CSS path. | n/a     | n/a                 |

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
    iconAliases: {
      // override built-in semantic icon names with your own iconify ids
      search: "ph:magnifying-glass",
    },
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
- `palette` — palette tuning (passed straight through to vunor): `{ colors: { primary, grey, neutral, error }, lightest, darkest, layersDepth, ... }`.
- `fingertip` — fingertip control heights (`xs/s/m/l/xl`).
- `iconAliases` — override the semantic icon ids (`search`, `close`, `filter`, …) — see the source's `defaultAsIconAliases` for the full list.

For deeper theming see the [vunor skill](https://github.com/maxim-mazurok/vunor) or its README — atscript-ui re-uses vunor's primitives and palette generator.

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
The pre-built CSS uses the **default theme** and cannot be themed. `excludeComponents` is also not honored — these files are baked once at our publish time.

The per-package files (`form.css`, `table.css`, `wf.css`) are **independently complete**, which means they overlap on shared shortcuts. **Don't combine them.** Load `all.css` if you use components from more than one package.

For theming or excluding components, switch to the UnoCSS path.
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

::: tip Tag-only
The resolver only handles **components** (Vue tags). Composables — `useTable`, `useFormState`, … — must still be imported explicitly:

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
    baseRadius: "8px",
    excludeComponents: ["as-filter-dialog"], // optional
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
