# Theme & Palette

`asPresetVunor()` forwards its options to vunor's `presetVunor`. Tuning a single brand color regenerates the entire `layer-*`, `surface-*`, `c8-*`, and `current-*` ladder — and every `as-*` shortcut that consumes them picks up the change automatically.

## Options

```typescript
interface AsPresetVunorOptions {
  baseRadius?: string;
  excludeComponents?: string[];
  iconOverrides?: Record<string, string>;
}
```

`asPresetVunor` accepts the above directly. Anything beyond that (palette, fingertip overrides, typography) flows through vunor's own preset, which is composed internally with sensible defaults. To override palette and fingertip from your app, drop down to vunor's `presetVunor` and pair it with the rest of our presets — covered below.

| Option              | Type                     | Default | Effect                                                                                                                                       |
| ------------------- | ------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseRadius`        | `string`                 | `"4px"` | Drives `rounded-base` and vunor's `r0..r4` ladder used across forms, table cells, dialogs, and chips.                                        |
| `excludeComponents` | `string[]`               | `[]`    | Kebab-case component names to drop from the safelist. Use when you swap a default for your own implementation and want to shed unused rules. |
| `iconOverrides`     | `Record<string, string>` | `{}`    | Replace baked icons with custom SVG strings or Iconify IDs. See [Icons](/styling/icons).                                                     |

## Minimal palette override

The cleanest place to set brand colors is at the vunor level. The atscript-ui defaults look like this internally:

```typescript
import { presetVunor } from "vunor/theme";

presetVunor({
  baseRadius: "4px",
  fingertip: {
    xs: "20px",
    s: "28px",
    m: "32px",
    l: "36px",
    xl: "40px",
  },
  palette: {
    colors: {
      primary: "#2563eb",
      grey: "#64748b",
      neutral: "#475569",
      error: "#dc2626",
    },
    lightest: 0.97,
    darkest: 0.22,
    layersDepth: 0.08,
  },
});
```

To override these in your app, replace `asPresetVunor()` with a hand-composed preset list that re-uses our extractor and shortcut tree but swaps in your own `presetVunor`:

```typescript
// uno.config.ts
import { defineConfig } from "unocss";
import { allShortcuts, createAsExtractor, mergeVunorShortcuts } from "@atscript/ui-styles";
import { presetVunor, vunorShortcuts } from "vunor/theme";
import presetIcons from "@unocss/preset-icons";
import { bakedIcons } from "@atscript/ui-styles";

export default defineConfig({
  content: { filesystem: ["src/**/*.{vue,ts,tsx}"] },
  presets: [
    presetIcons({
      collections: {
        as: (name) => bakedIcons[name],
      },
    }),
    presetVunor({
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
    {
      name: "atscript-ui-extractors",
      extractors: [createAsExtractor()],
    },
  ],
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

In most apps you don't need this much control — `asPresetVunor({ baseRadius })` plus a few `iconOverrides` is enough. Drop down to the hand-composed form only when you need a brand palette beyond the defaults.

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

For deeper customization of the vunor palette/typography see the [vunor documentation](https://vunor.dev).

## Next steps

- [Icons](/styling/icons) — bake-in defaults, overrides, and adding brand glyphs.
- [The as-\* Shortcut System](/styling/shortcuts) — how the shortcut tree is organized and how to extend it.
