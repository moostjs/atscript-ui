<p align="center">
  <a href="https://ui.atscript.dev" target="_blank" rel="noopener">
    <img src="https://ui.atscript.dev/logo.svg" alt="Atscript UI" height="96" />
  </a>
</p>

# @atscript/vue-wf

📚 **Documentation:** [ui.atscript.dev](https://ui.atscript.dev)

Vue 3 client for the atscript-ui workflow form — HTTP round-trip loop driven by metadata exchanged with a [`@atscript/moost-wf`](../moost-wf) server.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## What it provides

- `<AsWfForm>` — single component that drives the full workflow: posts current state, renders the next step's form, validates with the schema returned by the server, and resumes after pauses
- Hooks for custom transport, error display, and per-step UI overrides
- Built on [`@atscript/vue-form`](../vue-form), so all form-rendering primitives (field types, default renderers, layout grid) carry over

## Install

```sh
pnpm add @atscript/vue-wf
```

Peer requirements: `vue@^3`, `@atscript/vue-form`, `@atscript/typescript`.

## License

MIT © Artem Maltsev
