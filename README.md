<p align="center">
  <img src="https://ui.atscript.dev/logo.svg" alt="Atscript" width="120" />
</p>

<h1 align="center">Atscript UI</h1>

<p align="center">
  Automated forms and smart tables for <a href="https://github.com/moostjs/atscript">Atscript</a> — define your models once in <code>.as</code> files, get fully wired UI from the same metadata.
</p>

## Packages

| Package                                                   | Description                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`@atscript/ui`](packages/ui)                             | Framework-agnostic runtime — `FormDef`, `TableDef`, field resolver, validators           |
| [`@atscript/ui-fns`](packages/ui-fns)                     | Opt-in plugin adding dynamic `@ui.fn.*` field properties (uses `new Function`)           |
| [`@atscript/ui-table`](packages/ui-table)                 | Framework-agnostic filter model, filter → Uniquery conversion, preset serialization      |
| [`@atscript/vue-form`](packages/vue-form)                 | Vue 3 form components and composables                                                    |
| [`@atscript/vue-table`](packages/vue-table)               | Vue 3 table components, filter dialogs, virtualized rendering                            |
| [`@atscript/vue-wf`](packages/vue-wf)                     | Vue 3 workflow form — HTTP round-trip loop driven by atscript metadata                   |
| [`@atscript/moost-wf`](packages/moost-wf)                 | Server-side workflow integration for Moost — decorators, interceptors, state persistence |
| [`@atscript/moost-ui-presets`](packages/moost-ui-presets) | Moost controller and `.as` schema for table-preset persistence                           |

## Architecture

```
@atscript/ui                  ← framework-agnostic core
    ├── @atscript/ui-fns          ← opt-in dynamic field resolver
    ├── @atscript/ui-table        ← framework-agnostic table model
    ├── @atscript/vue-form        ← Vue 3 form components
    │       └── @atscript/vue-wf      ← Vue 3 workflow form
    │               └── @atscript/moost-wf       ← Moost server integration
    └── @atscript/vue-table       ← Vue 3 table components
            └── @atscript/moost-ui-presets   ← Moost preset persistence
```

## Documentation

See the full documentation at [ui.atscript.dev](https://ui.atscript.dev).

## Development

```bash
# Install dependencies
vp install

# Format, lint, test, and build everything
pnpm run ready

# Build all packages
pnpm run build

# Run all tests
pnpm run test

# Release (bump version, build, test, publish)
pnpm run release          # patch
pnpm run release:minor    # minor
pnpm run release:major    # major
```

## License

MIT
