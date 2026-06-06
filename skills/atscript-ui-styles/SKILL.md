---
name: atscript-ui-styles
description: >-
  Style atscript-ui components with `@atscript/ui-styles` — the UnoCSS preset
  + `AsResolver` for `unplugin-vue-components` + the `as-*` shortcut tree +
  baked semantic icons + pre-built CSS bundles. Use when wiring
  `asPresetVunor()` into `uno.config.ts`; when registering `AsResolver()` from
  `@atscript/ui-styles/vite` so Tier-1 components (`<AsForm>`, `<AsTable>`,
  `<AsWfForm>`, …) auto-import; when tuning the vunor palette / `baseRadius` /
  `fingertip` / `typography` (all flat at `asPresetVunor`'s top level) / dark
  mode; when overriding icons via `iconOverrides` or adding new ones via
  `@unocss/preset-icons`; when extending the shortcut tree with
  `mergeVunorShortcuts(allShortcuts, defineShortcuts({...}))`; when shipping
  without UnoCSS via `@atscript/ui-styles/css/{all,form,table,wf}`; or when
  inspecting `componentClasses` / `componentPackages` / `helperAliases` for
  custom build pipelines. Out of scope: vunor itself (use the `vunor` skill).
---

# atscript-ui-styles

## Install

```bash
npx skills add moostjs/atscript-ui      # installs all atscript-ui skills (this one + general + forms + tables + wf)
npx skills add mav-rik/vunor            # design system primitives (palette / scope / layer / surface / c8 / i8 / fingertip)
```

```bash
pnpm add @atscript/ui-styles vunor unocss @unocss/preset-icons unplugin-vue-components
```

## Quick start (UnoCSS path)

```ts
// uno.config.ts
import { defineConfig } from "unocss";
import { asPresetVunor, allShortcuts } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor({
    // Full presetVunor() theme is accepted flat. Omitted fields fall back to
    // atscript-ui's baked defaults (`defaultAsVunorOptions`). `palette.colors`
    // and `fingertip` shallow-merge per-key.
    baseRadius: "0.5rem",
    palette: { colors: { primary: "#a855f7" } }, // keeps grey/neutral/error
    // fingertip: { m: "36px" },
    // iconOverrides: { search: '<svg>...</svg>' },
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import unocss from "unocss/vite";
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default defineConfig({
  plugins: [vue(), Components({ resolvers: [AsResolver()] }), unocss()],
});
```

```ts
// main.ts
import "virtual:uno.css";
// ...
```

`AsResolver()` auto-imports Tier-1 primary components. Tier-2 defaults
(`AsInput`, `AsFilterDialog`, `AsConfigDialog`, …) are imported explicitly.

## Quick start (no UnoCSS)

```ts
import "@atscript/ui-styles/css/all"; // form + table + wf + common
// or per-package:
// import "@atscript/ui-styles/css/form";
// import "@atscript/ui-styles/css/table";
// import "@atscript/ui-styles/css/wf";
```

Pre-built CSS has the default vunor palette baked in — no runtime palette
tuning. Override individual CSS custom properties for brand colors.

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Components emit only `as-*` class names.** Two recommended customization paths: (a) tune vunor primitives (palette / scope / layer / surface / c8 / i8 / fingertip / spacing / typography) so all `as-*` shortcuts re-derive; (b) extend the shortcut tree via `mergeVunorShortcuts`. Direct CSS overrides of `as-*` rules also work, but they don't inherit palette / dark-mode tinting — pick what fits your project.          |
| 2   | **`asPresetVunor()` already injects `allShortcuts`.** Spread individual shortcut groups (`formShortcuts`, `tableShortcuts`, `wfShortcuts`, `commonShortcuts`) only when building a subset preset.                                                                                                                                                                                                                                  |
| 3   | **`AsResolver()` is Tier-1 only.** Auto-imports root components used in templates (`AsForm`, `AsField`, `AsIterator`, `AsTableRoot`, `AsTable`, `AsWindowTable`, `AsFilters`, `AsPresetPicker`, `AsTableActions`, `AsWfForm`). Tier-2 defaults (`AsInput`, `AsFilterDialog`, …) are imported explicitly; composables are never handled by `unplugin-vue-components`.                                                               |
| 4   | **`iconOverrides` only replaces existing aliases.** Unknown keys are ignored silently. To add brand-new icons compose your own `presetIcons` alongside ours under a different collection prefix (e.g. `lucide`, `brand`). See [icons.md](references/icons.md).                                                                                                                                                                     |
| 5   | **For override SVGs to inherit color/sizing, use `currentColor` and let `width`/`height` default to `1em`.** Icons inherit text color via vunor's `scope-*` / `layer-*` system through `currentColor`; a hardcoded `fill="#000"` will stay black across dark mode + `scope-error`. Likewise, pinned pixel `width`/`height` lock the icon to that size — `as-*` shortcuts size via `em`, so the em default tracks surrounding text. |
| 6   | **Pre-built CSS skips theme tuning.** `@atscript/ui-styles/css/*` ships the default vunor palette baked in. Use `asPresetVunor()` if you want to change the palette, base radius, fingertip ladder, or icon set at build time.                                                                                                                                                                                                     |
| 7   | **Class extractor is build-time, not runtime.** `createAsExtractor()` walks library subpath imports / tag names / helper calls in your source and pre-seeds the safelist. The pre-computed class map (`componentClasses`, `helperAliases`) is generated at our publish time — you don't run it.                                                                                                                                    |
| 8   | **`createIconsLoader` is internal.** It runs only inside `pnpm bake-icons` at our publish time and is not exported. User-facing icon customization is exclusively `asPresetVunor({ iconOverrides })` + standard `presetIcons` for new icons.                                                                                                                                                                                       |

## Key imports

```ts
// Preset + extractor
import { asPresetVunor, createAsBaseUnoConfig, createAsExtractor } from "@atscript/ui-styles";
import type {
  AsPresetVunorOptions,
  AsBaseUnoConfigOptions,
  AsExtractorOptions,
} from "@atscript/ui-styles";

// Shortcuts
import {
  commonShortcuts,
  formShortcuts,
  tableShortcuts,
  wfShortcuts,
  allShortcuts,
} from "@atscript/ui-styles";

// Class / helper maps (generated, mostly for advanced build setups)
import {
  componentClasses,
  componentPackages,
  getComponentClasses,
  getHelperClasses,
  helperAliases,
} from "@atscript/ui-styles";

// Baked icon map (read-only)
import { bakedIcons } from "@atscript/ui-styles";

// vunor re-exports — author your own shortcuts without a second import
import { defineShortcuts, mergeVunorShortcuts, toUnoShortcut } from "@atscript/ui-styles";
import type { TVunorShortcut } from "@atscript/ui-styles";

// Vite subpath
import { AsResolver } from "@atscript/ui-styles/vite";

// Pre-built CSS (no JS exports, side-effect import only)
// "@atscript/ui-styles/css/all"   "@atscript/ui-styles/css/form"
// "@atscript/ui-styles/css/table" "@atscript/ui-styles/css/wf"
```

## References — load only what's needed

| Domain        | File                                                | When                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First contact | [getting-started.md](references/getting-started.md) | Install matrix, full `uno.config.ts` + `vite.config.ts` (`asPresetVunor`, `AsResolver`), Tier-1 vs Tier-2 auto-import boundary, virtual `uno.css` entry                                                                                                                                                                                                                                                                                       |
| Theming       | [theming.md](references/theming.md)                 | Full vunor theme accepted flat at `asPresetVunor` top level: `palette.colors`, `lightest`, `darkest`, `layersDepth`, `baseRadius`, `fingertip`, `typography`. Baked defaults exported as `defaultAsVunorOptions`. Dark mode, scope tints, layer / surface tones, deriving brand colors.                                                                                                                                                       |
| Icons         | [icons.md](references/icons.md)                     | Default semantic alias set (what ships out of the box), `iconOverrides` shape + the `currentColor` / `1em` rules, adding new icons via `@unocss/preset-icons` (separate prefix), `bakedIcons` constant                                                                                                                                                                                                                                        |
| Shortcut tree | [shortcuts.md](references/shortcuts.md)             | `as-*` naming convention (variant suffix), four shortcut groups (form / table / wf / common), **overriding a built-in `as-*` shortcut** (append-not-replace merge, write only the one variant key, `!`-important + font numeric order, `content-['']` to blank a pseudo-element), extending with `mergeVunorShortcuts` + `defineShortcuts`, composing from vunor primitives for inherited theming, `excludeComponents` to drop unused classes |
| Pre-built CSS | [prebuilt-css.md](references/prebuilt-css.md)       | The four subpaths (`/css/{all,form,table,wf}`), trade-offs vs UnoCSS path, brand color tuning via CSS custom properties, HTML and Vite usage                                                                                                                                                                                                                                                                                                  |

## See also

Reference docs: https://ui.atscript.dev/styling/. Source: https://github.com/moostjs/atscript-ui.
