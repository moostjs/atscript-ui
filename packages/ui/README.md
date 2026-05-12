# @atscript/ui

Framework-agnostic runtime for form and table definitions from [atscript](https://github.com/moostjs/atscript) annotated types.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## What it provides

- `FormDef` / `TableDef` — parsed metadata containers for a `.as` type
- `FieldResolver` — pluggable strategy that reads `@ui.*`, `@meta.*`, `@expect.*` annotations
- Path utilities (`getByPath`, `setByPath`) and the wrapped form-data convention (`{ value: domainData }`)
- Built-in validators sourced from `@expect.*` annotations

The runtime is **pure TypeScript** — no Vue, no React. Vue bindings live in [`@atscript/vue-form`](../vue-form) and [`@atscript/vue-table`](../vue-table); a React port can be built on the same primitives.

## Install

```sh
pnpm add @atscript/ui
```

## Entry points

| Subpath | What it exports |
| --- | --- |
| `@atscript/ui` | `FormDef`, `TableDef`, `FieldResolver`, validators, path utilities |
| `@atscript/ui/plugin` | atscript code-generation plugin (build-time) |

## License

MIT © Artem Maltsev
