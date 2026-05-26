<p align="center">
  <a href="https://ui.atscript.dev" target="_blank" rel="noopener">
    <img src="https://ui.atscript.dev/logo.svg" alt="Atscript UI" height="96" />
  </a>
</p>

# @atscript/vue-aooth

📚 **Documentation:** [ui.atscript.dev](https://ui.atscript.dev/api/vue-aooth)

Custom Vue 3 form-field components for [Aooth](https://aooth.moost.org)-driven consent collection and password-policy display. Drops into `<AsForm :components>` from [`@atscript/vue-form`](../vue-form).

Part of the [atscript-ui](https://github.com/moostjs/atscript-ui) monorepo.

## What it provides

- `AsConsentArray` — multi-consent checkbox group bound to a `string[]`. Items arrive via `@ui.form.fn.attr` as `{ id, text, required? }`. Markdown `[label](url)` links in consent text are sanitized to `http(s)://` / `mailto:` only.
- `AsPasswordRules` — display-only readout of policy fulfilment. Each `{ rule, description? }` rule string is evaluated through `compileFieldFn` from `@atscript/ui-fns` against the live password.
- Both implement the `TAsComponentProps` contract from `@atscript/vue-form` — wire via `<AsForm :components>` and `@ui.form.component`.

## Install

```sh
pnpm add @atscript/vue-aooth
```

Peer requirements: `vue@^3`, `@atscript/vue-form`, `@atscript/ui-fns`, `@atscript/ui-styles`.

## Why a separate package

These components are Aooth-specific UX. Shipping them inside `@atscript/vue-form` would force consent chrome and password-rule machinery on every consumer who doesn't run auth flows. Apps that do — typically alongside [`@atscript/vue-wf`](../vue-wf) — pull this package in on top.

## License

MIT © Artem Maltsev
