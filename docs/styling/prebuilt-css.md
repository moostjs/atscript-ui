# Pre-built CSS

For apps that don't run UnoCSS, `@atscript/ui-styles` ships pre-baked stylesheets. Drop one `<link>` (or `import`) and `<AsForm>` / `<AsTable>` / `<AsWfForm>` paint correctly. No build step on your side, no UnoCSS in your dep tree.

## When to use it

- You're embedding atscript-ui into an existing app that already uses Tailwind / Bootstrap / handwritten CSS / another design system, and you don't want UnoCSS fighting with it.
- You're shipping a quick prototype or admin tool where you don't care about brand-color customization.
- You're not using a bundler at all (CDN-style integration).

If none of the above apply, go with the [UnoCSS path](/styling/installation) — it gives you theming, dynamic icon overrides, and an automatic safelist.

## Trade-offs

The pre-built bundles are sealed at our publish time. You give up:

- **Theming.** `baseRadius`, palette overrides, `iconOverrides`, and `excludeComponents` all happen at preset registration time. The pre-built CSS is generated against the library's default theme — your brand color can't propagate.
- **Auto-safelist.** The bundle ships every class for every default component, whether you use it or not. Bundle is larger by design.
- **Per-component splitting.** You can split by package (`form` / `table` / `wf` / `aooth`) but not by component.

In return: zero build-time integration. You can paste the stylesheet `<link>` into a static HTML page and it just works.

## Subpath imports

The package exposes five CSS subpaths:

| Subpath                         | Contents                                                                    |
| ------------------------------- | --------------------------------------------------------------------------- |
| `@atscript/ui-styles/css/all`   | Every shortcut from every package — pick this if you use more than one.     |
| `@atscript/ui-styles/css/form`  | `commonShortcuts` + `formShortcuts` only — for `@atscript/vue-form` apps.   |
| `@atscript/ui-styles/css/table` | `commonShortcuts` + `tableShortcuts` only — for `@atscript/vue-table` apps. |
| `@atscript/ui-styles/css/wf`    | `commonShortcuts` + `wfShortcuts` only — for `@atscript/vue-wf` apps.       |
| `@atscript/ui-styles/css/aooth` | `commonShortcuts` + `aoothShortcuts` only — for `@atscript/vue-aooth` apps. |

The per-package bundles are **independently complete** — each one ships its own copy of `commonShortcuts` and vunor primitives so it stands alone. That means they overlap on shared rules: **don't combine `form.css` + `table.css`** in the same app, use `all.css` instead.

## Vite / webpack / Rollup

Import once at your app entry:

```typescript
// src/main.ts
import "@atscript/ui-styles/css/all";

import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

For finer-grained loading, e.g. a forms-only product:

```typescript
import "@atscript/ui-styles/css/form";
```

## HTML `<link>`

For non-bundled setups, copy the file from `node_modules` into your `public/` dir (or serve it from a CDN) and link it directly:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="/atscript-ui.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

A minimal Vue mount looks identical to the UnoCSS path — the only thing that changes is the CSS source:

```typescript
// main.ts
import { createApp } from "vue";
import { AsForm } from "@atscript/vue-form";
import { User } from "./types/user.as";

const app = createApp({
  components: { AsForm },
  data: () => ({ User, model: { name: "", email: "" } }),
  template: `<AsForm :type="User" v-model="model" />`,
});

app.mount("#app");
```

## Brand-color overrides without UnoCSS

The vunor shortcuts engine atscript-ui uses internally emits CSS custom properties (the `--current-*`, `--surface-*`, `--scope-*` ladder) into the cascade. Even with the pre-built CSS, you can shift the brand color by overriding those custom properties on `:root` or on a scoped ancestor:

```css
:root {
  /* Adjust primary scope */
  --vunor-primary-h: 270;
  --vunor-primary-s: 80%;
  --vunor-primary-l: 55%;
}
```

This works at runtime — flip a class on `<html>` to pivot the whole palette without rebuilding CSS.

This trick lets you keep the pre-built workflow while still shipping a few brand tones. For anything deeper than primary-color tuning, switch to the UnoCSS path.

## Dark mode

The pre-built CSS includes the dark-mode rules for every shortcut. Add a `.dark` class to `<html>` (or any ancestor of the components) and the tree switches:

```html
<html class="dark">
  ...
</html>
```

Wire the toggle however your app does state. The shortcut tree already includes the `dark:` variants — no extra config required.

## Bundle size

Rough numbers for the published bundles (post-gzip, varies by version):

- `css/all` — ~32 KB.
- `css/form` — ~22 KB.
- `css/table` — ~24 KB.
- `css/wf` — ~16 KB.
- `css/aooth` — ~12 KB.

Compare this against an equivalent UnoCSS-generated bundle, which typically lands around 12–18 KB because the extractor strips unused classes. The pre-built path costs you bundle size for the convenience of skipping the build.

## Next steps

- [Installation](/styling/installation) — the UnoCSS path, recommended when you want theming.
- [Theme & Palette](/styling/theme) — what theming buys you over the pre-built bundle.
