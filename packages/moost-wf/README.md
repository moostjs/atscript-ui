<p align="center">
  <a href="https://ui.atscript.dev" target="_blank" rel="noopener">
    <img src="https://ui.atscript.dev/logo.svg" alt="Atscript UI" height="96" />
  </a>
</p>

# @atscript/moost-wf

📚 **Documentation:** [ui.atscript.dev](https://ui.atscript.dev)

Server-side workflow integration for [Moost](https://github.com/moostjs/moost) — decorators, interceptors, and serialization that pair with [`@atscript/vue-wf`](../vue-wf) to drive multi-step forms from atscript-annotated `.as` types.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## What it provides

- Workflow decorators that wrap Moost handlers and expose them as `@atscript/vue-wf`-compatible endpoints
- Interceptors that serialize / deserialize workflow state across HTTP requests
- `@AsWfState` storage abstraction with a default `@atscript/db`-backed implementation

## Install

```sh
pnpm add @atscript/moost-wf
```

Peer requirements: `moost`, `@moostjs/event-wf`, `@atscript/core`, `@atscript/typescript`.

## Entry points

| Subpath                       | What it exports                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `@atscript/moost-wf`          | Workflow decorators, interceptors, runtime                                         |
| `@atscript/moost-wf/plugin`   | atscript build-time plugin                                                         |
| `@atscript/moost-wf/store`    | Generated runtime for `AsWfStateRecord`                                            |
| `@atscript/moost-wf/store.as` | Raw `.as` source for the workflow-state record — re-import if you customize fields |

## License

MIT © Artem Maltsev
