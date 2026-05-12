# @atscript/vue-table

Type-driven table components for Vue 3 — virtualized tables, filter dialogs, column config, preset persistence, all wired from an atscript-annotated `.as` type.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo. Built on [`@atscript/ui`](../ui) and [`@atscript/ui-table`](../ui-table).

## What it provides

- `<AsTable>`, `<AsTableRoot>`, `<AsFilters>` — tier-1 components users tag in templates
- Default cell renderers (`AsCellDate`, `AsCellNumber`, `AsCellArray`, …) and dialogs (`AsFilterDialog`, `AsConfigDialog`, `AsPresetDialog`) under `@atscript/vue-table/as-*` subpaths
- Window-virtualized variant (`<AsWindowTable>`) backed by `@tanstack/vue-virtual`
- Composable: `useAsTable` — provides the model-driven state contract documented in the root CLAUDE.md

## Install

```sh
pnpm add @atscript/vue-table
```

Peer requirements: `vue@^3`, `reka-ui@^2`, `@tanstack/vue-virtual@^3`, `@vueuse/core`, `@atscript/db-client`.

## License

MIT © Artem Maltsev
