# @atscript/ui-fns

Opt-in plugin for [`@atscript/ui`](../ui) that adds **dynamic** field properties driven by `@ui.fn.*` annotations.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## Why it's a separate package

`@ui.fn.*` annotations let `.as` schemas declare computed UI behaviour (e.g. `@ui.fn.disabled (form) => form.value.kind !== 'admin'`). Evaluating them requires `new Function` at runtime, which is incompatible with strict CSPs. Splitting the dynamic resolver into its own package keeps `@atscript/ui` CSP-safe by default — consumers opt in only when they need expressions.

## Install

```sh
pnpm add @atscript/ui-fns
```

## Entry points

| Subpath | What it exports |
| --- | --- |
| `@atscript/ui-fns` | `FnFieldResolver` — drop-in replacement for the default `FieldResolver` |
| `@atscript/ui-fns/plugin` | atscript build-time plugin that compiles `@ui.fn.*` bodies |

## License

MIT © Artem Maltsev
