Ship `@atscript/vue-*` components into an app that doesn't run UnoCSS — Tailwind / CSS-Modules / Sass projects, pure HTML demos, server-side rendered static pages.

## Contents

- [When to use](#when-to-use)
- [Subpaths](#subpaths)
- [Side-effect import](#side-effect-import)
- [Trade-offs vs UnoCSS path](#trade-offs-vs-unocss-path)
- [Brand color overrides via CSS custom properties](#brand-color-overrides-via-css-custom-properties)
- [Plain HTML mount](#plain-html-mount)
- [Recipe — Vite with pre-built CSS only](#recipe--vite-with-pre-built-css-only)

## When to use

| Scenario                                                                | Pre-built CSS? | UnoCSS path? |
| ----------------------------------------------------------------------- | -------------- | ------------ |
| New Vue 3 app, brand palette tuning required                            | no             | yes          |
| Existing Tailwind project, want to drop `@atscript/vue-form` in         | yes            | no           |
| Existing CSS-Modules / Sass project, no Tailwind / no UnoCSS            | yes            | no           |
| Storybook / pure HTML demo                                              | yes            | no           |
| You need `iconOverrides`, `excludeComponents`, or `palette` overrides   | no             | yes          |

The pre-built path ships the default vunor palette baked into the CSS file. You cannot retune `palette.colors.primary` at build time when using pre-built CSS — only at runtime via CSS custom properties (next section).

## Subpaths

```typescript
import "@atscript/ui-styles/css";        // alias for /all
import "@atscript/ui-styles/css/all";    // form + table + wf + common
import "@atscript/ui-styles/css/form";   // form + common
import "@atscript/ui-styles/css/table";  // table + common
import "@atscript/ui-styles/css/wf";     // wf + common
```

Sizes (approximate, current `dist/css/`):

| Subpath           | LOC   | Bundles                                    |
| ----------------- | ----- | ------------------------------------------ |
| `/css/all`        | ~1600 | all icons, all `as-*` rules, preflights    |
| `/css/table`      | ~1600 | table is the heaviest — virtual scroll, filter pills, dialogs |
| `/css/form`       | ~440  | form + common                              |
| `/css/wf`         | ~440  | wf + common                                |

Cherry-pick the narrowest subpath that matches your usage. A forms-only app should import `/css/form` — saves ~75% over `/css/all`.

Source: `packages/ui-styles/package.json` (lines 39-44).

## Side-effect import

The `/css/*` subpaths export NO JavaScript symbols. They're CSS files; importing them executes them as a side effect (the bundler injects the CSS into the output, the dev server serves them as part of the HMR graph):

```typescript
// main.ts
import "@atscript/ui-styles/css/all";

import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

Order matters: import the CSS BEFORE component modules so the styles attach to the document before the first paint.

## Trade-offs vs UnoCSS path

| Aspect                 | Pre-built CSS                                                              | UnoCSS path                                                          |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Bundle size            | Full safelist baked in — larger                                            | Extractor + safelist-prune — smaller, scales with usage              |
| Palette tuning         | Runtime only — override `--scope-color-*` / `--scope-light-*` / `--scope-dark-*` CSS vars | Build-time — pass `palette` to `asPresetVunor()`                     |
| `iconOverrides`        | Not available                                                              | Build-time — pass `iconOverrides`                                    |
| `excludeComponents`    | Not available                                                              | Build-time — drop unused defaults from safelist                      |
| Adding new icons       | Not via this package (use a separate `<style>` block or your own CSS)      | Compose `@unocss/preset-icons` under a different prefix              |
| Adding new shortcuts   | Not via this package (write plain CSS by hand)                             | `mergeVunorShortcuts(allShortcuts, defineShortcuts({...}))`           |
| Dark mode              | Auto via media query (vunor emits `:root` + `.dark` rules in the CSS file) | Same, plus customizable via UnoCSS `dark: 'class'` strategy           |
| Vue 3 + atscript still required | Yes                                                                | Yes                                                                  |

The vue components require Vue 3 and `@atscript/*` regardless of the styling path — pre-built CSS only replaces the build-time UnoCSS dependency.

## Brand color overrides via CSS custom properties

vunor exposes its palette ramp as CSS variables on `:root`. Override them at the document level or on a scoped ancestor (e.g. a "branded section" wrapper) to retune the look without rebuilding.

Variables emitted by the bundled vunor preset:

| Variable                  | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `--scope-color`           | Active scope's mid-tone (R G B triplet, space-separated)      |
| `--scope-color-50`..`-900` | Full 50-900 ramp of the active scope                          |
| `--scope-light-0`..`-4`   | Light-mode foreground / background ladder                     |
| `--scope-dark-0`..`-4`    | Dark-mode foreground / background ladder                      |
| `--scope-hl`              | Active scope's highlight tone                                 |
| `--current-hl`            | `current-hl` resolved against active scope                    |
| `--current-text`          | Default text color in active surface/layer                    |
| `--current-bg`            | Default bg color in active surface/layer                      |
| `--current-border`        | Default border color in active surface/layer                  |
| `--current-outline`       | Focus-ring outline color in active scope                      |

Values are space-separated R G B triplets — vunor composes `rgb(var(--scope-color-500) / <opacity>)` internally so `bg-current-hl/15` works.

```css
/* Override at :root for app-wide brand swap. */
:root {
  --scope-color-500: 59 130 246;   /* tailwind blue-500 */
  --scope-color-400: 96 165 250;   /* blue-400 */
  --scope-color-600: 37  99 235;   /* blue-600 */
  /* …match the full ramp if you want clean hover/active transitions */
}

/* Or limit the override to a branded section. */
.brand-section {
  --scope-color-500: 16 185 129;   /* emerald */
}
```

Inspect `node_modules/@atscript/ui-styles/dist/css/all.css` (around line 50, the `:root` block) to see the full set of variables shipped at the current version. The exact set is stable across patch releases; minor versions may add new variables but won't rename existing ones.

For complex palette tuning (re-deriving `lightest` / `darkest` / `layersDepth`), the UnoCSS path is the only option — pre-built CSS bakes those derivations in.

## Plain HTML mount

The vue-* components require Vue 3 and `@atscript/*` runtime regardless of how you load the CSS. Minimal example:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>atscript-ui static demo</title>
    <link rel="stylesheet" href="/node_modules/@atscript/ui-styles/dist/css/all.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

```typescript
// main.ts
import { createApp } from "vue";
import { AsForm } from "@atscript/vue-form";

createApp({
  components: { AsForm },
  template: `<AsForm :type="MyType" v-model="data" />`,
  data: () => ({ data: { value: {} } }),
}).mount("#app");
```

You still bring atscript runtime + a Vite/Rollup/esbuild step to compile the `.vue` SFCs and resolve `@atscript/*`. The pre-built CSS path only removes the UnoCSS build dependency.

## Recipe — Vite with pre-built CSS only

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
});
```

```typescript
// main.ts
import "@atscript/ui-styles/css/all";  // CSS side-effect — FIRST

import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

No `unocss/vite` plugin, no `unplugin-vue-components`, no `AsResolver()`. You import `<AsForm>`, `<AsTable>`, etc. explicitly:

```vue
<script setup lang="ts">
import { AsForm } from "@atscript/vue-form";
import { AsTable } from "@atscript/vue-table";
</script>
```

This is the simplest possible setup. Bundle size is fixed at the size of the `/css/*` file you imported (no extractor pruning), but you avoid the entire UnoCSS pipeline.
