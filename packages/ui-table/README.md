# @atscript/ui-table

Framework-agnostic table model for atscript-driven UIs — filter conditions, filter→Uniquery conversion, and preset serialization.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## What it provides

- **Filter model** — `FilterField`, `FilterCondition`, operator metadata derived from `@ui.table.*` and `@expect.*` annotations
- **`filtersToUniquery`** — converts the in-memory filter state to a [`@uniqu/core`](https://github.com/moostjs/uniqu) query that any compliant data source can execute
- **Preset serialization** — encode/decode the full table state (columns, sorters, filters, pagination, search) for persistence
- **Sorter & column-set model** — display vs. applied state pairs, no implicit cleanup loops

Like [`@atscript/ui`](../ui), this is **pure TypeScript** — Vue bindings live in [`@atscript/vue-table`](../vue-table).

## Install

```sh
pnpm add @atscript/ui-table
```

## License

MIT © Artem Maltsev
