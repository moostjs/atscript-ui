# Styling

`@atscript/ui-styles` is the styling layer that powers every `@atscript/vue-*` package. It ships a UnoCSS preset, a Vite component resolver, a tree of `as-*` shortcut classes, baked icons, and pre-built CSS bundles. Forms, tables, and workflow forms all emit `as-*` class names and inherit the same theme from a single source of truth.

## The vunor middleware story

atscript-ui ships generic on purpose. The UI components emit semantic `as-*` class names like `as-form`, `as-cell-decimal`, `as-filter-dialog` — never colors, pixel values, or design-system specifics. The translation from `as-*` to actual CSS rules happens inside `@atscript/ui-styles`, which composes those classes from **vunor** primitives (`scope-*`, `layer-*`, `surface-*`, `c8-*`, `i8-*`, spacing tokens, fingertip heights, typography).

[Vunor](https://vunor.dev) is the customization middleware. It is published as a separate npm package and owns the palette generator, the layer/surface ladder, the button chromium primitives, and the icon-fill helpers. The intended path: override vunor's theme — palette colors, radius, fingertip heights, typography — and the entire `as-*` tree restyles itself automatically. From there you can layer your own `as-*` shortcuts on top of `allShortcuts` to extend or repaint individual concepts.

The supported customization path: **components emit `as-*` class names; tune vunor primitives or merge your own `as-*` shortcuts on top of `allShortcuts` and your brand color set in `asPresetVunor({ palette })` propagates into every form input, table cell, filter pill, and dialog.** You can also write app-level CSS that targets `as-*` selectors directly — see the trade-offs below.

## Two ways to use it

There are two integration paths. Pick one based on whether you already use UnoCSS.

### a) UnoCSS preset (recommended)

Install `unocss` and `@atscript/ui-styles`, then call `asPresetVunor()` in `uno.config.ts`. You get:

- Full theme control (palette, radius, fingertip heights).
- A class extractor that walks your sources and safelists exactly what each form / table actually renders.
- Dynamic icon overrides via `iconOverrides`.
- The freedom to merge your own `as-*` shortcuts on top of `allShortcuts`.

Walk through it on the [Installation](/styling/installation) page.

### b) Pre-built CSS bundles (no build step)

If your app doesn't use UnoCSS, import a pre-baked stylesheet at your entry:

```ts
import "@atscript/ui-styles/css/all";
```

The bundle ships every shortcut for every package, baked against the default vunor theme. No build-time customization is possible — you trade theming for zero setup. See [Pre-built CSS](/styling/prebuilt-css) for details and per-package bundles.

## The `as-*` shortcut model

Components in `vue-form`, `vue-table`, and `vue-wf` render only `as-*` class names on their elements. The rules behind those classes live in `@atscript/ui-styles/src/shortcuts/{form,table,wf,common}/` and are composed from vunor primitives.

You have two ways to customize the look:

1. **Tune through vunor / merge `as-*` shortcuts** (recommended). Brand changes happen once, at the vunor layer, and the rest of the UI follows. Trade-off: you learn the shortcut tree.
2. **Write app-level CSS that targets `as-*` selectors directly.** Works fine, especially for one-off tweaks. Trade-off: hand-rolled overrides need to keep up if the shortcut body later gains a `hover:` or `focus-within:` variant, and the rule won't follow palette changes.

The first-class customization vectors are:

- **Theme:** `asPresetVunor({ baseRadius, palette })` — see [Theme & Palette](/styling/theme).
- **Icons:** `asPresetVunor({ iconOverrides })` — see [Icons](/styling/icons).
- **New shortcuts (additive):** `mergeVunorShortcuts([allShortcuts, defineShortcuts({ 'as-foo-extra': '...' })])` — see [The as-\* Shortcut System](/styling/shortcuts).
- **Removing default-component styles:** `asPresetVunor({ excludeComponents })` when you swap a default for your own component.

## Next steps

- [Installation](/styling/installation) — wire UnoCSS, the resolver, and CSS into a Vite app.
- [Theme & Palette](/styling/theme) — set brand colors, radius, and dark mode.
- [Icons](/styling/icons) — swap baked icons, add brand glyphs.
- [The as-\* Shortcut System](/styling/shortcuts) — extend or compose shortcuts.
- [Pre-built CSS](/styling/prebuilt-css) — no-UnoCSS integration.
