Tune brand colors, radii, dark mode, scope tints, and depth layers via `asPresetVunor` + vunor primitives. Doing it through the preset re-derives every `as-*` rule automatically and stays consistent with dark mode and scope tinting. (You can also override `as-*` rules in your own CSS — that works too, it just won't inherit those derivations.)

## Contents

- [asPresetVunor options](#aspresetvunor-options)
- [Palette overrides](#palette-overrides)
- [Recipe — brand palette swap](#recipe--brand-palette-swap)
- [Built-in palette defaults](#built-in-palette-defaults)
- [Dark mode](#dark-mode)
- [Scope tints (scope-\*)](#scope-tints-scope-)
- [Layer / surface tones (layer-_, surface-_)](#layer--surface-tones-layer--surface-)
- [C8 button chromium (c8-\*)](#c8-button-chromium-c8-)
- [Spacing, typography, fingertip](#spacing-typography-fingertip)
- [baseRadius vs hardcoded radii](#baseradius-vs-hardcoded-radii)
- [Theme-aware alternatives to common hardcoded values](#theme-aware-alternatives-to-common-hardcoded-values)

## asPresetVunor options

```typescript
// AsBaseUnoConfigOptions is just vunor's `presetVunor()` option type — every
// field (`baseRadius`, `palette`, `fingertip`, `typography`, `animation`, …)
// is accepted flat at the top level of asPresetVunor's input.
interface AsBaseUnoConfigOptions extends AsVunorPresetOptions {}

interface AsPresetVunorOptions extends AsBaseUnoConfigOptions {
  excludeComponents?: string[]; // kebab names dropped from extractor safelist
  iconOverrides?: Record<string, string>; // alias → SVG string; see icons.md
}
```

Returns `Preset[]` — pass directly to UnoCSS's `presets`.

Every vunor field is optional. The baked atscript-ui defaults (`defaultAsVunorOptions`, also exported) fill in any omitted value. Two fields merge per-key so consumers can override one entry without redeclaring the whole map:

- `palette.colors` — `{ primary: "#ff0000" }` keeps `grey` / `neutral` / `error` defaults
- `fingertip` — `{ m: "36px" }` keeps the other four sizes

All other fields (`baseRadius`, `typography`, `animation`, `palette.lightest`, etc.) replace the default wholesale — provide a complete shape if you set them.

## Palette overrides

`palette` is a vunor `presetVunor` option. The most commonly tuned fields:

| Field            | Type       | Purpose                                                             |
| ---------------- | ---------- | ------------------------------------------------------------------- |
| `colors.primary` | hex string | Brand accent — flows into `scope-primary`, `c8-filled`, focus rings |
| `colors.grey`    | hex string | Neutral / chrome — backgrounds, borders, secondary text             |
| `colors.error`   | hex string | Danger scope — `scope-error`                                        |
| `colors.good`    | hex string | Success scope — `scope-good`                                        |
| `colors.warn`    | hex string | Warning scope — `scope-warn`                                        |
| `colors.neutral` | hex string | Neutral scope — `scope-neutral`                                     |
| `lightest`       | `0..1`     | Top of the light ladder (closer to `1` = brighter highlights)       |
| `darkest`        | `0..1`     | Bottom of the dark ladder (closer to `0` = deeper shadows)          |
| `layersDepth`    | `0..1`     | Distance between `layer-0` / `layer-1` / `layer-2` tones            |

vunor derives the full ladder (`scope-color-50..900`, `--scope-light-*`, `--scope-dark-*`, `layer-*`, `surface-*`, `c8-filled` fg/bg, `current-hl`, `current-outline-hl`, etc.) from these. Full reference: vunor skill.

## Recipe — brand palette swap

```typescript
import { defineConfig } from "unocss";
import { asPresetVunor, allShortcuts } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor({
    baseRadius: "6px",
    palette: {
      colors: {
        primary: "#3b82f6", // tailwind blue-500
        grey: "#6b7280", // tailwind gray-500
        error: "#ef4444", // tailwind red-500
        good: "#10b981", // tailwind emerald-500
        warn: "#f59e0b", // tailwind amber-500
      },
      lightest: 0.97,
      darkest: 0.2,
      layersDepth: 0.08,
    },
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

The brand swap re-derives every `as-*` rule's color, focus ring, hover state, and disabled tone automatically. No CSS overrides required.

## Built-in palette defaults

For reference (so you can see what changes when you override). `defaultAsVunorOptions` is exported from `@atscript/ui-styles` so you can read or extend it from your own config:

| Color         | Default   | Source         |
| ------------- | --------- | -------------- |
| `primary`     | `#2563eb` | blue accent    |
| `grey`        | `#64748b` | slate neutrals |
| `neutral`     | `#475569` | slate (darker) |
| `error`       | `#dc2626` | red-600 danger |
| `lightest`    | `0.97`    | —              |
| `darkest`     | `0.22`    | —              |
| `layersDepth` | `0.08`    | —              |

Fingertip ladder (control heights):

| Token          | Default |
| -------------- | ------- |
| `fingertip-xs` | `20px`  |
| `fingertip-s`  | `28px`  |
| `fingertip-m`  | `32px`  |
| `fingertip-l`  | `36px`  |
| `fingertip-xl` | `40px`  |

## Dark mode

vunor emits both light and dark variants of every scope color and surface tone via CSS variables. UnoCSS's standard dark-mode strategies both work:

```typescript
// uno.config.ts — class strategy
export default defineConfig({
  presets: asPresetVunor({
    /* ... */
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
  // omit `dark` to use the default media-query strategy, OR:
  // dark: 'class',
});
```

The `as-*` shortcut tree uses explicit `dark:` selectors only where the layer/scope system can't auto-flip (e.g. paired text colors on inputs, or hand-painted scrollbar tones — paired `text-scope-dark-0 dark:text-scope-light-0` is the typical pattern). For your own shortcuts, prefer `layer-0` / `surface-50` / `scope-*` tokens — they flip with the theme automatically.

## Scope tints (scope-\*)

A "scope" tints the element + descendants with one of vunor's palette ramps. Used on chips, badges, error banners, hover states, button intents, etc.

| Class             | Tints to                        |
| ----------------- | ------------------------------- |
| `scope-primary`   | brand accent (`colors.primary`) |
| `scope-error`     | danger / red                    |
| `scope-good`      | success / green                 |
| `scope-warn`      | warning / amber                 |
| `scope-neutral`   | neutral / slate                 |
| `scope-secondary` | vunor secondary scope           |

Inside a scope, semantic helpers resolve against the scope's ramp:

- `current-hl` — the scope's highlight tone (e.g. `bg-current-hl/10` = 10% scope tint background).
- `current-border-hl` — the scope's highlight border tone.
- `current-outline-hl` — the scope's outline-ring tone (used with `outline i8-apply-outline`).

Example from the bundled `as-form-error` shortcut:

```typescript
"as-form-error":
  "scope-error surface-50 border-1 rounded-r2 px-$m py-$s mb-$s text-callout text-current-hl flex items-center gap-$s",
```

`scope-error` paints the family. `surface-50` picks the lightest surface tone within that scope. `text-current-hl` lifts the message text to the scope's accent. Switching `scope-error` to `scope-good` recolors the entire banner with one token. See the vunor skill for the full scope/current-\* contract.

## Layer / surface tones (layer-_, surface-_)

| Class         | Depth                                                      |
| ------------- | ---------------------------------------------------------- |
| `layer-0`     | Base / canvas background (inputs, table body)              |
| `layer-1`     | One step elevated (hover row, table head, sticky elements) |
| `layer-2`     | Two steps elevated (popups, menu hover, kbd badges)        |
| `surface-50`  | Lightest tinted surface within active scope                |
| `surface-100` | Slightly stronger tint                                     |

`layersDepth` controls the visual distance between consecutive layers. Increase it (e.g. `0.12`) for more pronounced elevation, decrease it (`0.05`) for a flatter look. See the vunor skill for the complete layer/surface ladder.

## C8 button chromium (c8-\*)

Pre-built button "chromiums" — bg + fg + hover/active in one token. Always combine with a scope (`scope-primary c8-filled`, etc.).

| Class         | When to use                                                 |
| ------------- | ----------------------------------------------------------- |
| `c8-filled`   | Primary CTA — solid scope bg, contrasting fg                |
| `c8-flat`     | Secondary / tertiary actions — text-only, hover paints bg   |
| `c8-outlined` | Bordered button — transparent bg, scope outline + text      |
| `c8-light`    | Subtle action (e.g. dialog dismiss) — tinted bg, scope text |
| `c8-chrome`   | Neutral chrome button (dialog cancel) — surface bg + text   |

Good to know: `c8-filled` derives the contrasting foreground from the active scope. If you also set `text-*` on a `c8-filled` button, it will erase that contrast (e.g. red text on red bg). The clean way to switch a `c8-filled` button's intent is to retune the scope (`!scope-error`) and leave `c8-filled` to pick the matching foreground.

## Spacing, typography, fingertip

Use vunor tokens when you want palette / dark-mode / scale to track automatically; pixel literals work too, they just stay fixed.

| Intent            | Token(s)                                                       |
| ----------------- | -------------------------------------------------------------- |
| Spacing           | `$xxs`, `$xs`, `$s`, `$m`, `$l`, `$xl`, `$xxl`                 |
| Control height    | `h-fingertip-xs/s/m/l/xl`, `size-fingertip-*`, `w-fingertip-*` |
| Body text         | `text-body`                                                    |
| Caption text      | `text-callout`                                                 |
| Larger body       | `text-body-l`                                                  |
| Icon glyph sizing | em-based — `text-[1em]`, `text-[1.25em]`, `text-[3em]`         |
| Elevated shadow   | `shadow-popup`                                                 |
| Default border    | `border-1` alone pulls color from the active surface/layer     |
| Focus ring        | `current-outline-hl outline i8-apply-outline`                  |

## baseRadius vs hardcoded radii

vunor exposes a 5-step radius ladder anchored on `baseRadius`:

| Class          | Result                            |
| -------------- | --------------------------------- |
| `rounded-r0`   | smallest — half `baseRadius`      |
| `rounded-r1`   | `baseRadius`                      |
| `rounded-r2`   | `baseRadius` × 1.5                |
| `rounded-r3`   | `baseRadius` × 2 (dialog corners) |
| `rounded-r4`   | largest — `baseRadius` × 3        |
| `rounded-base` | same as `rounded-r1`              |
| `rounded-full` | ellipse / pill                    |

Set `baseRadius: "8px"` for a softer look or `baseRadius: "0px"` for a sharp / brutalist feel. If you want consumers of your own design system to tune radius globally, prefer `rounded-base` / `rounded-r0..r4` over hardcoded sizes like `rounded-[4px]` — those compose against `baseRadius` and re-derive with it.

## Theme-aware alternatives to common hardcoded values

If you want a value to track the theme (palette swap, dark mode, scope tinting, base-radius tuning), reach for the tokenized version instead of a literal. All forms below are valid CSS — these are recommendations for staying in the theme system.

| Hardcoded form                                 | What you lose if you keep it                           | Theme-aware alternative                        |
| ---------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `.as-form-error { color: ... }` in your CSS    | Won't pick up palette swaps or dark-mode tinting       | Tune `palette.colors.error` in `asPresetVunor` |
| `border-grey-200 dark:border-grey-800`         | Pins color; won't follow scope + dark mode             | `border-1` alone — color from active surface   |
| Inline `[box-shadow:0_0_0_3px_...]` focus ring | Bypasses theme; won't track `scope-*` + dark mode      | `current-outline-hl outline i8-apply-outline`  |
| `rounded-[4px]`                                | Ignores `baseRadius`                                   | `rounded-r1` or `rounded-base`                 |
| `text-[length:13px]`                           | Bypasses typography ladder                             | `text-body` / `text-callout` / `text-body-l`   |
| `h-[32px]`                                     | Bypasses fingertip ladder; doesn't track touch targets | `h-fingertip-m`                                |
