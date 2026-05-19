Wiring `@atscript/ui-styles` into a Vue 3 + UnoCSS app — full config files, auto-import boundary, verification.

## Contents

- [Install](#install)
- [vite.config.ts](#viteconfigts)
- [uno.config.ts](#unoconfigts)
- [main.ts](#maints)
- [Tier-1 vs Tier-2 auto-import](#tier-1-vs-tier-2-auto-import)
- [Verifying the setup](#verifying-the-setup)
- [Reading list](#reading-list)

## Install

```bash
pnpm add @atscript/ui-styles vunor unocss @unocss/preset-icons unplugin-vue-components
```

Peer deps: `vunor`, `unocss`, `@unocss/preset-icons`, `unplugin-vue-components` (optional — only needed if you use `AsResolver()`). See `packages/ui-styles/package.json` (lines 77-87).

## vite.config.ts

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import unocss from "unocss/vite";
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default defineConfig({
  plugins: [
    vue(),
    // `AsResolver()` auto-imports Tier-1 primary components only.
    // Order matters only relative to other resolvers — list yours first
    // if you want them to win on name collisions.
    Components({ resolvers: [AsResolver()] }),
    unocss(),
  ],
});
```

`AsResolver()` returns a `ComponentResolverObject` from `unplugin-vue-components` and resolves Vue tags matching `/^As[A-Z]/` against the package's `primaryComponents` set, returning `default` from a subpath import (e.g. `@atscript/vue-form/as-form`). See `packages/ui-styles/src/vite.ts` (lines 24-36).

## uno.config.ts

```typescript
import { defineConfig } from "unocss";
import { asPresetVunor, allShortcuts } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  // `asPresetVunor` returns Preset[] — pass it directly to `presets`.
  // Do NOT wrap in another array; UnoCSS would treat the inner array as
  // a single preset and crash.
  presets: asPresetVunor({
    baseRadius: "0.5rem",
    // palette: { colors: { primary: '#3b82f6' } },
    // iconOverrides: { search: '<svg viewBox="0 0 24 24">...</svg>' },
    // excludeComponents: ['as-input'],
  }),
  // `allShortcuts` is already a merged `TVunorShortcut[]` (form + table +
  // wf + common). Wrap it in `vunorShortcuts()` once and hand the result
  // to UnoCSS.
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

`asPresetVunor()` already injects the class extractor and the icon collection (under prefix `as`). Avoid registering a second `presetIcons({ collections: { as: ... } })` with the same `as` prefix — it would overwrite the bundled mapping. Use a different prefix for your own icons (see [icons.md](icons.md)). See `packages/ui-styles/src/preset.ts` (lines 236-245).

| Knob                | Type                     | Default         | Purpose                                                                  |
| ------------------- | ------------------------ | --------------- | ------------------------------------------------------------------------ |
| `baseRadius`        | `string`                 | `"4px"`         | Forwarded to vunor `baseRadius`; drives `rounded-base` + `r0..r4` ladder |
| `iconOverrides`     | `Record<string, string>` | `undefined`     | Per-alias SVG override merged on top of `bakedIcons`                     |
| `excludeComponents` | `string[]`               | `undefined`     | Kebab component names dropped from the extractor's safelist              |
| `palette`           | vunor palette config     | design defaults | Forwarded to `presetVunor({ palette })` — see [theming.md](theming.md)   |

## main.ts

```typescript
// 1. CSS reset BEFORE `virtual:uno.css` so vunor's preflight (loaded by
//    asPresetVunor → presetVunor) lands on top of a normalized baseline.
//    Skipping the reset leaves headings / lists in browser defaults that
//    fight vunor's typography ladder (text-body, text-callout, ...).
//    Any UnoCSS reset works — Tailwind-compat is the most common:
import "@unocss/reset/tailwind.css";

// 2. Virtual UnoCSS entry — it must run before any component module so
//    the extractor sees their imports during the dev server's first scan.
import "virtual:uno.css";

// 3. (optional) Your global stylesheet — fonts, body baseline, overrides.
import "./styles/app.css";

// 4. App boot.
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

`@unocss/reset` is a peer of `unocss` (already in your deps). Pick a variant: `tailwind.css` (closest to vunor's design assumptions), `tailwind-compat.css`, `normalize.css`, or `eric-meyer.css`. The reset is **not** shipped by `@atscript/ui-styles` and is technically optional — but vunor's preflight assumes normalized defaults, so without one you'll see browser-default serif on headings, list bullets where you don't want them, etc.

Fonts are NOT shipped by `@atscript/ui-styles`. Add your own font stack to `app.css` — vunor's typography ladder (`text-body`, `text-callout`, `text-body-l`) reads from `font-family: inherit`.

## Tier-1 vs Tier-2 auto-import

`AsResolver()` resolves Tier-1 root components only — what end users tag in templates. Tier-2 defaults (swap targets for `:types` / `:components` prop maps) and composables are imported explicitly.

| Tier                           | Examples                                                                                                                                          | How to import                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Tier 1 — primary (auto)**    | `AsForm`, `AsField`, `AsIterator`, `AsTableRoot`, `AsTable`, `AsWindowTable`, `AsFilters`, `AsPresetPicker`, `AsTableActions`, `AsWfForm`         | Type the tag in a `<template>` — `AsResolver()` injects import |
| **Tier 2 — defaults (manual)** | `AsInput`, `AsSelect`, `AsCheckbox`, `AsRadio`, `AsTextarea`, `AsFilterDialog`, `AsConfigDialog`, `AsCellNumber`, `AsCellDate`, `AsCellJson`, ... | `import { AsInput } from "@atscript/vue-form"`                 |
| **Composables**                | `useAsForm`, `useTable`, `useAsField`, ...                                                                                                        | `import { useAsForm } from "@atscript/vue-form"`               |
| **Tier 3 — internals**         | `AsTableBase`, `AsTableVirtualizer`, `AsOrderableList`, `AsFilterConditions`, ...                                                                 | Not exported. Not importable.                                  |

Tag-name + helper-call + subpath-import detection drives the extractor's safelist; see `packages/ui-styles/src/extractor.ts` (lines 49-70). If you import a Tier-2 default with `import { AsInput } from "@atscript/vue-form"`, its classes are added to the safelist automatically.

## Verifying the setup

1. Run the dev server.
2. Mount a single `<AsForm>` or `<AsTable>` somewhere in `App.vue`.
3. Open the page and inspect the generated UnoCSS output (the `<style id="unocss">` tag or DevTools' Sources tab).
4. Search for `as-form`, `as-field`, or `as-table` class rules. If present, the extractor matched and the shortcut tree resolved.
5. Search for `i-as-search`, `i-as-chevron-down`, etc. — icons should be data-URL masks (not iconify network fetches).

If `as-*` rules are missing: confirm `presets: asPresetVunor(...)` is spread correctly, the file actually imports `<AsForm>` (extractor short-circuits on files that contain none of `@atscript/`, `<As`, `<as-`, or a known helper name — see `extractor.ts:32-39`), and `virtual:uno.css` is loaded.

If `i-as-*` icons are missing: confirm `@unocss/preset-icons` is installed (it's a peer dep), and that no other `presetIcons({ collections: { as: ... } })` is overwriting the bundled mapping.

## Reading list

- [theming.md](theming.md) — palette / baseRadius / dark mode / scope-layer-surface-c8 primer
- [icons.md](icons.md) — default alias set, `iconOverrides` shape, adding new icons under separate prefixes
- [shortcuts.md](shortcuts.md) — `as-*` naming, four shortcut groups, extending with `mergeVunorShortcuts`, `excludeComponents`
- [prebuilt-css.md](prebuilt-css.md) — `/css/{all,form,table,wf}` subpaths for non-UnoCSS apps
