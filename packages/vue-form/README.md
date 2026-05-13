<p align="center">
  <a href="https://ui.atscript.dev" target="_blank" rel="noopener">
    <img src="https://ui.atscript.dev/logo.svg" alt="Atscript UI" height="96" />
  </a>
</p>

# @atscript/vue-form

📚 **Documentation:** [ui.atscript.dev](https://ui.atscript.dev)

Type-driven form rendering for Vue 3 — components and composables that turn an atscript-annotated `.as` type into a fully wired form.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo. Built on [`@atscript/ui`](../ui).

## What it provides

- `<AsForm>`, `<AsField>`, `<AsIterator>` — tier-1 components users tag in templates
- Default input renderers (`AsInput`, `AsSelect`, `AsCheckbox`, `AsDate`, …) under `@atscript/vue-form/as-*` subpaths — swappable via the `:types` / `:components` prop map
- Composables: `useAsForm`, `createDefaultTypes`, …
- Headless: zero design-system assumptions. Styling lives in [`@atscript/ui-styles`](../ui-styles) (UnoCSS) or your own layer.

## Install

```sh
pnpm add @atscript/vue-form
```

Peer requirements: `vue@^3`, `reka-ui@^2`, `@atscript/db-client`, `@atscript/ui-fns`.

## Auto-resolved tags (optional)

```ts
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default {
  plugins: [Components({ resolvers: [AsResolver()] })],
};
```

## License

MIT © Artem Maltsev
