# aooth-components

`@atscript/vue-aooth` ships five pre-built custom field components used across [Aooth](https://aooth.moost.org) auth flows. All implement the `TAsComponentProps` contract and drop into `<AsForm :components>` (or `<AsWfForm :components>`) via `@ui.form.component`. None are auto-resolved — register each by name; the `.as` annotation value is just the map key.

## Contents

- [Components](#components)
- [Registration](#registration)
- [Phantom + context pattern](#phantom--context-pattern)
- [Invariants](#invariants)
- [Key imports](#key-imports)
- [See also](#see-also)

## Components

| Component         | Binds                 | Purpose                                                                                                                                         |
| ----------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `AsConsentArray`  | `string[]`            | Multi-consent checkbox group; per-item `required` validation; markdown links (`http(s)`/`mailto` only).                                         |
| `AsPasswordRules` | display-only          | Live password-policy readout; rows toggle `data-passed="true"\|"false"`.                                                                        |
| `AsQrCode`        | `string \| undefined` | SVG QR from any string (TOTP enrolment); surfaces `?secret=` manual-entry fallback for `otpauth://`.                                            |
| `AsCopy`          | `string \| undefined` | Read-only input + Copy button (`navigator.clipboard`); magic links, share tokens, generated ids.                                                |
| `AsSsoProviders`  | `string \| undefined` | SSO/social-login provider picker; main-stack buttons + `secondary:true` chips below an "or" divider; one click selects + fires the form action. |

Custom props are fed via `@ui.form.fn.attr`, typically reading from `formContext`:

- `AsConsentArray` → `pendingConsents: { id, text, required? }[]` (empty/missing ⇒ whole field hidden).
- `AsPasswordRules` → `policies: { rule, description?, errorMessage? }[]` + `password` (live sibling value). `rule` strings compile through `@atscript/ui-fns`' `compileFieldFn` (shared FNPool); first arg is the password.
- `AsQrCode` → `size?` (default 192), `errorCorrection?` (`L|M|Q|H`, default `M`), `manualSecret?` (default true).
- `AsCopy` → `copyLabel?` ("Copy"), `copiedLabel?` ("Copied").
- `AsSsoProviders` → `providers: { id, text, icon?, secondary? }[]`. `text` verbatim (no prefix); `icon` applied as-is (safelist it); default→main stack, `secondary:true`→chip below the divider; empty/missing ⇒ field hidden.

Wire the picker with a field-level action so a click submits the chosen provider:

```atscript
@ui.form.component 'AsSsoProviders'
@ui.form.action 'sso', 'Continue'
@ui.form.fn.attr 'providers', '(_v, _d, ctx) => ctx.ssoProviders'
ssoProvider?: string
```

Full prop shapes + worked examples: docs API reference at https://ui.atscript.dev/api/vue-aooth#component-asssoproviders and the narrative at https://ui.atscript.dev/forms/aooth-components.

## Registration

```ts
import {
  AsConsentArray,
  AsCopy,
  AsPasswordRules,
  AsQrCode,
  AsSsoProviders,
} from "@atscript/vue-aooth";

const components = {
  "consent-array": AsConsentArray,
  copy: AsCopy,
  "password-rules": AsPasswordRules,
  "qr-code": AsQrCode,
  "sso-providers": AsSsoProviders,
};
// <AsForm :components="components"> + @ui.form.component 'qr-code' on the field
```

Styles: prebuilt CSS at `@atscript/ui-styles/css/aooth` (import once), or picked up automatically by apps running the vunor UnoCSS preset.

## Phantom + context pattern

`AsQrCode` and `AsCopy` are best used as **phantom** display fields backed by workflow context — three pieces:

1. Field typed `ui.paragraph` so the form treats it as non-data chrome (nothing read/written on submit).
2. `@ui.form.fn.value '(v, data, ctx) => ctx.someKey'` supplies the displayed value.
3. On workflow forms, `@wf.context.pass 'someKey'` whitelists the key into the client `formContext` — without it `ctx.someKey` is `undefined`.

```atscript
@wf.context.pass 'totpUri'
export interface EnrolStep {
    @meta.label 'Scan with your authenticator app'
    @ui.form.fn.value '(v, data, ctx) => ctx.totpUri'
    @ui.form.component 'qr-code'
    totpUri: ui.paragraph
}
```

When the value must land in bound data (typed columns, serialization), use a data field with `@meta.readonly` + `@ui.form.fn.value` instead — `AsField`'s readonly watcher writes the resolved value into the bound path. Phantom is cleaner whenever the value is display-only.

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Field-level `@ui.form.fn.*` callbacks are `(v, data, ctx, entry)`.** The two-arg `(_, ctx) => …` shape is wrong — arg 2 is `data`. Only **form-level** keys (root `@ui.form.fn.title` / `fn.description` / `submit.text` / `submit.disabled`) use `(data, ctx)`.                                                                                                                                                                                               |
| 2   | **`qrcode` is an optional peer dependency.** Install it in the consumer app only for flows using `AsQrCode`; it is dynamic-imported, so apps without the dep pay no bundle cost.                                                                                                                                                                                                                                                                                 |
| 3   | **`AsConsentArray` hides the whole field when `pendingConsents` is empty/missing.** Drives the "show the legal block only when the backend has pending consents" pattern. Missing-required messages render per-row; the shell footer is suppressed.                                                                                                                                                                                                              |
| 4   | **`AsPasswordRules` reads empty password as all-unpassed**, even if a no-op rule would return true. Throwing rules count as unpassed and log once per distinct source.                                                                                                                                                                                                                                                                                           |
| 5   | **`AsQrCode` / `AsCopy` read `props.value ?? props.model?.value`.** Phantom registrations push through `props.value`; data-bound fields use `model.value`. For `otpauth://` URIs `AsQrCode` also renders the parsed secret unless `:manualSecret="false"`.                                                                                                                                                                                                       |
| 6   | **`AsSsoProviders` is one-click.** Clicking a provider sets `model.value=id` then emits the field's `@ui.form.action` (surfaced as `<AsForm>` `@action(name, data)`, provider in `data`); there is NO separate submit button. Needs `@ui.form.action` on the field; add `@wf.action.withData` in workflow forms so the provider rides the submission. `text` is rendered verbatim; `secondary:true` ⇒ chip below the "or" divider (default ⇒ main-stack button). |

## Key imports

```ts
import {
  AsConsentArray,
  AsCopy,
  AsPasswordRules,
  AsQrCode,
  AsSsoProviders,
} from "@atscript/vue-aooth";
// per-component subpaths exist too: @atscript/vue-aooth/as-qr-code, @atscript/vue-aooth/as-sso-providers, …
```

## See also

- [customization.md](customization.md) — the `TAsComponentProps` contract these components implement
- [dynamic-fields.md](dynamic-fields.md) — `@ui.form.fn.*` reference (incl. the fn-signature scope)
- `atscript-ui-wf` skill — `@wf.context.pass` whitelist for phantom fields inside workflow forms
- Docs: https://ui.atscript.dev/forms/aooth-components, https://ui.atscript.dev/api/vue-aooth
