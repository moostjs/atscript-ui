# Installation

This page wires `@atscript/ui-styles` into a fresh Vite + Vue 3 app: the UnoCSS preset, the component auto-resolver, and the CSS hookup.

## Install dependencies

```bash
pnpm add @atscript/ui-styles vunor unocss unplugin-vue-components
```

You also need the `@atscript/vue-*` packages whose components you actually use:

```bash
pnpm add @atscript/vue-form @atscript/vue-table @atscript/vue-wf
```

`vunor` is a peer dependency of `@atscript/ui-styles`. Installing it explicitly keeps your lockfile aligned with the version atscript-ui was tested against.

## `vite.config.ts`

Register UnoCSS and `unplugin-vue-components` with `AsResolver()` from `@atscript/ui-styles/vite`.

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    Components({
      resolvers: [AsResolver()],
    }),
  ],
});
```

`AsResolver()` auto-imports Tier-1 components — the ones you tag directly in templates: `<AsForm>`, `<AsField>`, `<AsIterator>`, `<AsTable>`, `<AsTableRoot>`, `<AsWindowTable>`, `<AsFilters>`, `<AsPresetPicker>`, `<AsTableActions>`, `<AsWfForm>`. Tier-2 default implementations (`AsInput`, `AsSelect`, `AsFilterDialog`, …) are public and importable but **not** auto-resolved — you import them explicitly when you compose custom `:types` / `:components` maps. Composables (`useTable`, `useFormState`, …) always require an explicit `import`.

## `uno.config.ts`

Add `asPresetVunor()` to the preset list. Merge `allShortcuts` (the full atscript-ui shortcut tree) through `vunorShortcuts()` so vunor can expand its primitives inside our shortcut bodies.

```typescript
import { defineConfig } from "unocss";
import {
  allShortcuts,
  asPresetVunor,
  defineShortcuts,
  mergeVunorShortcuts,
} from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  content: {
    filesystem: ["src/**/*.{vue,ts,tsx}"],
  },
  presets: asPresetVunor({
    baseRadius: "6px",
    // Brand colors, fingertip ladder, typography, animation, etc. all sit
    // flat at this level — `asPresetVunor` accepts the full presetVunor()
    // theme. See [Theme & Palette](/styling/theme) for the full option list.
    // palette: { colors: { primary: '#a855f7' } },
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

A few notes:

- **`asPresetVunor()` already returns `Preset[]`** — pass it directly. Don't wrap it in another array, or UnoCSS will flatten silently and lose the extractor.
- **`vunorShortcuts(allShortcuts)`** — the wrapper that compiles vunor shortcut objects into UnoCSS-compatible `[selector, body]` tuples. Required when you pass our shortcuts to UnoCSS's `shortcuts` option.
- **`content.filesystem`** scans your own source files. You don't need to add `node_modules/@atscript/**` — the preset registers a custom extractor that walks `@atscript/vue-*` imports / `<AsX>` tags / helper calls (`createDefaultTypes()`, `createDefaultControls()`, `createDefaultCellTypes()`) in your code and pulls in pre-computed safelists.

### Adding your own shortcuts

`mergeVunorShortcuts` is associative — feel free to layer in app-specific shortcuts on top of the library's:

```typescript
const appShortcuts = defineShortcuts({
  "page-shell": "flex flex-col min-h-screen layer-0",
  "page-header": "flex items-center gap-$m px-$l py-$s border-b-1",
});

export default defineConfig({
  presets: asPresetVunor(),
  shortcuts: [vunorShortcuts(mergeVunorShortcuts([allShortcuts, appShortcuts]))],
});
```

### SSR

For SSR setups, UnoCSS still works the same way, but make sure `unocss/vite` runs in both client and server passes so the safelist matches. You may also want to add an extra `presetIcons()` for icons referenced from `.as` schemas (annotation values that emit `i-as-*` class names statically). You only need that escape hatch when `@ui.form.prefix.icon` or similar paints a class name our extractor can't see in `.vue` / `.ts` sources:

```typescript
safelist: ["i-as-star-filled", "i-as-search"];
```

## CSS hookup

Import UnoCSS's virtual stylesheet exactly once, at your app entry:

```typescript
// src/main.ts
import "virtual:uno.css";
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

That's all the CSS plumbing needed for the UnoCSS path. UnoCSS generates utility CSS on-demand, scoped to the safelist (your source + atscript-ui's component classes).

Typography is intentionally **not** baked into `@atscript/ui-styles` — real consumers bring their own font stack.

## Verify

Mount any primary component and inspect the network panel.

```vue
<script setup lang="ts">
import { User } from "./types/user.as";
import { ref } from "vue";

const data = ref<User>({ name: "", email: "" });
</script>

<template>
  <AsForm :type="User" v-model="data" />
</template>
```

In your browser's network panel, look for the UnoCSS-generated stylesheet (`/@unocss-devtools/...` in dev, hashed `.css` in build). You should see `as-form`, `as-field-label`, `as-default-field`, and the underlying `scope-*` / `layer-*` rules. If you don't see them, the extractor isn't reaching your source — double-check `content.filesystem` covers your files and that `<AsForm>` is actually being rendered.

## Next steps

- [Theme & Palette](/styling/theme) — set your brand color and radius.
- [Icons](/styling/icons) — swap baked icons or add brand glyphs.
- [The as-\* Shortcut System](/styling/shortcuts) — how the shortcut tree is organized and how to extend it.
