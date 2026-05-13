<p align="center">
  <a href="https://ui.atscript.dev" target="_blank" rel="noopener">
    <img src="https://ui.atscript.dev/logo.svg" alt="Atscript UI" height="96" />
  </a>
</p>

# @atscript/moost-ui-presets

📚 **Documentation:** [ui.atscript.dev](https://ui.atscript.dev)

Moost controller + `.as` schema for persisting [`@atscript/vue-table`](../vue-table) presets on the server.

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## What it provides

- A drop-in Moost controller exposing CRUD endpoints for table presets (per-user, per-table)
- The `.as` schema and DB record for preset storage, backed by [`@atscript/moost-db`](https://github.com/moostjs/atscript-db)
- Wire-compatible with the preset payload that [`@atscript/ui-table`](../ui-table) serializes

## Install

```sh
pnpm add @atscript/moost-ui-presets
```

Peer requirements: `moost`, `@moostjs/event-http`, `@atscript/db`, `@atscript/moost-db`, `@atscript/ui-table`.

## License

MIT © Artem Maltsev
