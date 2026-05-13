# Icons

`@atscript/ui-styles` ships a sealed set of semantic icons under the `i-as-*` namespace. Forms, tables, and workflow forms reference these by alias (`i-as-search`, `i-as-loading`, `i-as-close`) — never by Iconify ID — so a single `iconOverrides` map rebrands every glyph across the UI.

## What ships out of the box

The default set covers everything the built-in components render: dialog close buttons, table filter/sort/columns triggers, refresh, value-help affixes, in-flight overlays, optional-field toggles, chevrons, drag handles, trash, plus / minus, pin, star, theme toggle, validation warning.

The SVGs are baked at our publish time — no Iconify API calls happen during your build, no `.icons/` folder appears in your project, no extra dependency. The full alias map is also re-exported as a read-only constant:

```typescript
import { bakedIcons } from "@atscript/ui-styles";

console.log(Object.keys(bakedIcons).sort());
// ['arrow-down', 'arrow-up', 'check', 'check-square', 'chevron-down', ...]
```

You typically don't need to read `bakedIcons` — it's there for tooling and debugging.

## Overriding an icon

Pass `iconOverrides` to `asPresetVunor()`. Keys are the alias names (`search`, `close`, `loading`, …); values are full `<svg>...</svg>` strings.

```typescript
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor({
    iconOverrides: {
      search:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="currentColor" stroke-width="2"/></svg>',
      loading:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    },
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

Two recommendations for override SVGs if you want them to behave like the built-in icons:

1. **Use `currentColor` for fill / stroke.** Icons inherit color from the surrounding text via vunor's scope / layer system. A hardcoded `fill="#000"` keeps that color in dark mode and inside `scope-error` rather than tinting with context — fine if that's the look you want.
2. **Set `viewBox` and let `width` / `height` default to `1em`.** The `i-as-*` class system sizes via `em`, so SVGs without pinned pixel dimensions scale with surrounding text.

Unknown keys are ignored, so `iconOverrides: { brandSomething: ... }` won't break anything — it just won't paint anywhere.

## Adding brand-new icons

`iconOverrides` only replaces existing aliases. For new icons — your brand glyphs, an entire Iconify collection, etc. — compose your own `presetIcons` alongside ours under a different collection prefix:

```typescript
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";
import presetIcons from "@unocss/preset-icons";

export default defineConfig({
  presets: [
    ...asPresetVunor(),
    presetIcons({
      collections: {
        // Bring in an official Iconify package (pnpm add -D @iconify-json/lucide)
        lucide: () => import("@iconify-json/lucide/icons.json").then((i) => i.default),
        // Or a custom inline set
        brand: {
          logo: '<svg xmlns="..." viewBox="0 0 100 100">...</svg>',
        },
      },
    }),
  ],
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

`i-lucide-search` and `i-brand-logo` now resolve alongside `i-as-search` — different prefixes, zero coordination needed. See the [UnoCSS `presetIcons` docs](https://unocss.dev/presets/icons) for the full API.

## Em-based sizing

Every `as-*` shortcut that renders an icon sizes it with `em`, not pixels:

```typescript
"as-overlay-icon": "i-as-loading text-[3em]",
"as-cell-json-trigger-glyph": "font-700 text-[1em]",
"as-field-remove-btn-icon": "i-as-close text-[1em]",
```

Icons scale with the surrounding text. Inside a `text-callout` row, `text-[1em]` is `0.85em`; inside a `text-body-l` row, `text-[1em]` is `1.15em`. If you add your own `as-*` shortcut that renders an icon and want it to follow the same rhythm, use `text-[1em]` for inline glyphs, `text-[1.25em]` for slightly larger control glyphs (close buttons), `text-[3em]` for overlay spinners. Pinning a fixed `w-[16px] h-[16px]` is also fine — it just won't scale with the surrounding typography.

## Next steps

- [The as-\* Shortcut System](/styling/shortcuts) — how shortcut bodies reference icons via `i-as-*`.
- [Theme & Palette](/styling/theme) — palette tuning that feeds icon colors via `currentColor`.
