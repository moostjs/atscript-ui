<p align="center">
  <a href="https://ui.atscript.dev" target="_blank" rel="noopener">
    <img src="https://ui.atscript.dev/logo.svg" alt="Atscript UI" height="96" />
  </a>
</p>

# @atscript/moost-wf

Documentation: [ui.atscript.dev](https://ui.atscript.dev)

Server-side workflow integration for [Moost](https://github.com/moostjs/moost) — decorators, composables, and serialization that pair with [`@atscript/vue-wf`](../vue-wf) to drive multi-step forms from atscript-annotated `.as` types.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## What it provides

- `useAtscriptWf(Type)` composable — schema-aware `resolveInput()` / `resolveAction()` / `requireInput()` for step handlers.
- `@WfInput()` / `@WfAction()` parameter decorators — sugar over `useAtscriptWf()` with the full action-vs-input policy matrix.
- `useWfAction()` for low-level action context access.
- Schema helpers: `serializeFormSchema`, `extractPassContext`, `getFormActions`.
- HTTP outlet integration: `createAsHttpOutlet`, `handleAsOutletRequest`.
- Finish-screen envelope helpers: `finishWf`, `abortWf`, `isWfFinished`, and the `WfFinished` / `WfNext` / `WfMessage` / `WfButton` / `WfActionRequest` types rendered by `<AsWfFinish>`. See [Finish Screens](https://ui.atscript.dev/workflows/finish-screens).
- Opt-in persistent state store `AsWfStore` (subpath `/store`) backed by `@atscript/db`.

The workflow engine catches `StepRetriableError` (thrown by `requireInput()`) natively — no global interceptor wiring required.

## Install

```sh
pnpm add @atscript/moost-wf
```

Peer requirements: `moost`, `@moostjs/event-wf`, `@wooksjs/event-core`, `@wooksjs/event-wf`, `@atscript/core`, `@atscript/typescript`.

## Entry points

| Subpath                       | What it exports                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `@atscript/moost-wf`          | Workflow decorators, composables, outlet helpers, finish-screen envelope helpers   |
| `@atscript/moost-wf/plugin`   | atscript build-time plugin (registers `@wf.*` annotations)                         |
| `@atscript/moost-wf/store`    | `AsWfStore` runtime + `AsWfStateRecord` model                                      |
| `@atscript/moost-wf/store.as` | Raw `.as` source for the workflow-state record — re-import if you customize fields |

## License

MIT &copy; Artem Maltsev
