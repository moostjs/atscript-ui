# Theme & Palette

`asPresetVunor()` accepts vunor's full `presetVunor` theme directly at the top level. Tuning a single brand color regenerates the entire `layer-*`, `surface-*`, `c8-*`, and `current-*` ladder — and every `as-*` shortcut that consumes them picks up the change automatically.

## Options

`asPresetVunor()`'s input is vunor's `presetVunor()` option type plus two atscript-specific extras (`excludeComponents`, `iconOverrides`). Every vunor field — `baseRadius`, `palette`, `fingertip`, `typography`, `animation`, … — is flat at the top level:

```typescript
interface AsPresetVunorOptions extends /* vunor's presetVunor options */ {
  excludeComponents?: string[];
  iconOverrides?: Record<string, string>;
}
```

Omitted fields fall back to atscript-ui's baked defaults. Two of them merge per-key so you can override one entry without redeclaring the whole map:

- **`palette.colors`** — `{ primary: "#ff0000" }` keeps `grey` / `neutral` / `error` defaults.
- **`fingertip`** — `{ m: "36px" }` keeps the other four sizes.

Every other field (`baseRadius`, `palette.lightest`, `typography`, `animation`, …) replaces the default wholesale — provide the full shape if you set it. The baked defaults are exported as `defaultAsVunorOptions` if you want to read or spread them.

| Option              | Type                                    | Default        | Effect                                                                                                                                       |
| ------------------- | --------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseRadius`        | `string`                                | `"4px"`        | Drives `rounded-base` and vunor's `r0..r4` ladder used across forms, table cells, dialogs, and chips.                                        |
| `palette`           | vunor `TVunorPaletteOptions`            | see below      | Brand palette — `colors.primary`, `colors.grey`, `colors.error`, plus `lightest` / `darkest` / `layersDepth`. `colors` is per-key merged.    |
| `fingertip`         | `{ xs/s/m/l/xl?: string }`              | see below      | Touch-target ladder driving `h-fingertip-*` / `size-fingertip-*`. Per-key merged.                                                            |
| `typography`        | vunor typography map                    | vunor defaults | Override individual entries in the typography ladder (`body`, `callout`, `h1`, …). Wholesale replacement of the whole map.                   |
| `animation`         | `{ durations / animation / keyframes }` | vunor defaults | Animation tokens. Wholesale replacement.                                                                                                     |
| `excludeComponents` | `string[]`                              | `[]`           | Kebab-case component names to drop from the safelist. Use when you swap a default for your own implementation and want to shed unused rules. |
| `iconOverrides`     | `Record<string, string>`                | `{}`           | Replace baked icons with custom SVG strings or Iconify IDs. See [Icons](/styling/icons).                                                     |

## Baked-in defaults

For reference (so you can see what changes when you override). Source: `defaultAsVunorOptions` in `@atscript/ui-styles`.

```typescript
const defaultAsVunorOptions = {
  baseRadius: "4px",
  fingertip: { xs: "20px", s: "28px", m: "32px", l: "36px", xl: "40px" },
  palette: {
    colors: {
      primary: "#2563eb", // blue accent
      grey: "#64748b", // slate neutrals
      neutral: "#475569", // slate (darker)
      error: "#dc2626", // red-600
    },
    lightest: 0.97,
    darkest: 0.22,
    layersDepth: 0.08,
  },
};
```

## Brand palette swap

The cleanest place to set brand colors is `asPresetVunor()` itself — no hand-composed preset list required:

```typescript
// uno.config.ts
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  content: { filesystem: ["src/**/*.{vue,ts,tsx}"] },
  presets: asPresetVunor({
    baseRadius: "8px",
    palette: {
      colors: {
        primary: "#a855f7", // your brand
        grey: "#71717a",
        neutral: "#52525b",
        error: "#ef4444",
        good: "#22c55e",
        warn: "#eab308",
      },
      lightest: 0.98,
      darkest: 0.18,
      layersDepth: 0.06,
    },
    fingertip: {
      xs: "18px",
      s: "26px",
      m: "32px",
      l: "38px",
      xl: "44px",
    },
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

You don't need to provide every key — anything omitted keeps the baked default. The smallest possible brand swap:

```typescript
presets: asPresetVunor({
  palette: { colors: { primary: "#a855f7" } },
}),
```

`grey`, `neutral`, and `error` keep their defaults; `lightest` / `darkest` / `layersDepth` keep theirs; `fingertip` and `baseRadius` keep theirs.

## Brand color propagation

The point of the palette story is that **a single brand color set in one place repaints every form and table.** Vunor's palette generator derives the full lightness ladder from your `primary`:

- `scope-primary` — the active scope. Every `as-*` shortcut that uses `scope-primary` (filter dialogs, focus rings, primary submit buttons) follows.
- `layer-0`, `layer-1`, `layer-2` — surface fill stacked by depth. Form inputs, table cells, dialog backdrops use these.
- `current-*` — text/border/outline color of the active scope. Drives `text-current/70`, `border-current/30`, `current-outline-hl`, etc.
- `c8-filled`, `c8-flat`, `c8-outlined`, `c8-light`, `c8-chrome` — the five button chromiums. Primary submit buttons, dialog actions, action menus all consume one of these.

You don't have to memorize the cascade. Set `palette.colors.primary` and inspect any form's submit button or any table's filter dialog — the brand color is there.

## Border radius

`baseRadius` drives the `r0..r4` ladder:

- `r0` — sharpest (e.g. dense data rows, `as-kbd` keyboard hint).
- `r1` — small buttons, pills, chips.
- `r2` — default for inputs, table cells, error banners.
- `r3` — dialogs, popup cards.
- `r4` — modal containers, prominent surfaces.

If you set `baseRadius: "0"`, every container goes sharp. If you set `baseRadius: "12px"`, the ladder scales up proportionally. The default is `4px`.

## Dark mode

`@atscript/ui-styles` ships dark-aware shortcuts. UnoCSS's default `dark:` variant is configured by `presetWind`-style presets vunor brings in; the active strategy is `class` mode — toggle a `dark` class on `<html>` (or the closest ancestor) and the entire tree switches.

```html
<html class="dark">
  ...
</html>
```

Vunor's `layer-*` / `surface-*` / `c8-*` primitives already include `dark:` rules internally, so most `as-*` shortcuts don't need to spell them out. Where a shortcut does need explicit dark handling (e.g. an input's explicit text color or a hand-painted scrollbar), it uses paired `text-scope-dark-0 dark:text-scope-light-0` / `dark:` variant keys — see `as-decimal-number.ts` (`innerInputReset` constant) and `as-window-scrollbar.ts` under `packages/ui-styles/src/shortcuts/{form,table}/` for examples.

To wire up a toggle, drive the class with VueUse:

```vue
<script setup lang="ts">
import { useDark, useToggle } from "@vueuse/core";

const isDark = useDark();
const toggleDark = useToggle(isDark);
</script>

<template>
  <button @click="toggleDark()">
    <span :class="isDark ? 'i-as-sun' : 'i-as-moon'" />
  </button>
</template>
```

## Reference: full config

```typescript
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  content: { filesystem: ["src/**/*.{vue,ts,tsx}"] },
  presets: asPresetVunor({
    baseRadius: "8px",
    iconOverrides: {
      search:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="..."/></svg>',
    },
    excludeComponents: ["as-filter-dialog", "as-config-dialog"],
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

For deeper palette/typography tweaks (advanced palette config — `mainPalette`, `layerPalette`, `surfaces`), pass them as `palette` keys to `asPresetVunor` directly. The full vunor option shape is documented in the [vunor](https://github.com/mav-rik/vunor) docs.

## Next steps

- [Icons](/styling/icons) — bake-in defaults, overrides, and adding brand glyphs.
- [The as-\* Shortcut System](/styling/shortcuts) — how the shortcut tree is organized and how to extend it.
