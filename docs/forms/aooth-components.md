---
outline: deep
---

# Aooth-flavoured field components

`@atscript/vue-aooth` ships a small set of pre-built custom field components
used across [Aooth](https://aooth.moost.org) flows — multi-consent collection,
password-policy display, QR-code enrolment, and one-shot link/token sharing.
All four implement the `TAsComponentProps` contract from
[`@atscript/vue-form`](/forms/custom-components) and drop into
`<AsForm :components>` via the `@ui.form.component` annotation.

None of them are auto-resolved — register each one by name in the components
map. The component name in the `.as` annotation is just a key into that map;
match whichever convention you prefer (`'AsConsentArray'`, `'consent-array'`,
`'consents'` — pick one, stay consistent).

```ts
import { AsConsentArray, AsCopy, AsPasswordRules, AsQrCode } from "@atscript/vue-aooth";

const components = {
  "consent-array": AsConsentArray,
  copy: AsCopy,
  "password-rules": AsPasswordRules,
  "qr-code": AsQrCode,
};
```

Styles ship two ways. Pre-built CSS lives at
`@atscript/ui-styles/dist/css/aooth.css` — import it once at app start to get
the entire aooth bundle. Apps already running
[vunor](/styling/) pick the classes up through the runtime UnoCSS preset
without an extra import.

## AsConsentArray

Multi-consent checkbox group with per-item required validation and inline
markdown links. The bound value is `string[]`; checked ids are committed
in insertion order.

Source: `packages/vue-aooth/src/components/as-consent-array.vue`.

```ts
interface AsConsentArrayItem {
  id: string;
  text: string; // supports [label](url) for http(s)/mailto
  required?: string; // non-empty string ⇒ mandatory; doubles as the error message
}

interface AsConsentArrayProps extends TAsComponentProps<string[]> {
  pendingConsents?: AsConsentArrayItem[];
}
```

- Empty / missing `pendingConsents` hides the entire shell — useful for "show
  the legal block only when the backend has pending consents".
- Required misses surface their `required` string under the row; the shell
  footer is suppressed to avoid duplicate messaging.
- Only `http://`, `https://`, and `mailto:` link schemes render as anchors —
  anything else falls back to verbatim text.

```atscript
@ui.form.component 'consent-array'
@ui.form.fn.attr 'pendingConsents', '(v, data, ctx) => ctx.pendingConsents'
consents: string[]
```

The full server-driven flow lives in the API reference at
[@atscript/vue-aooth](/api/vue-aooth#component-asconsentarray).

## AsPasswordRules

Display-only readout of password-policy fulfilment. Pair it with a sibling
password field; the component re-evaluates on every keystroke and toggles each
row's met / unmet state via `data-passed="true" | "false"`.

Source: `packages/vue-aooth/src/components/as-password-rules.vue`.

```ts
interface AsPasswordRulesPolicy {
  rule: string; // function-string, evaluated through compileFieldFn
  description?: string;
  errorMessage?: string;
}

interface AsPasswordRulesProps extends TAsComponentProps {
  policies?: AsPasswordRulesPolicy[];
  password?: string;
}
```

- Rule strings reuse `@atscript/ui-fns`' `compileFieldFn` — the same FNPool
  cache the framework uses for `@ui.form.fn.*`. Two policies with the same
  rule body share one compiled instance.
- Empty password ⇒ every row reads as unpassed, even if a no-op rule would
  technically return true.
- Throwing rules are treated as unpassed and logged once per distinct source.

```atscript
@ui.form.type 'paragraph'
@ui.form.component 'password-rules'
@ui.form.fn.attr 'policies', '(v, data, ctx) => ctx.passwordPolicies'
@ui.form.fn.attr 'password', '(v, data) => data.newPassword'
passwordHints: string
```

See [@atscript/vue-aooth](/api/vue-aooth#component-aspasswordrules) for the
full reference and a worked example.

## AsQrCode

Phantom field that renders an SVG QR code from any string. Primarily used for
TOTP enrolment — for `otpauth://` URIs it also surfaces the `?secret=` query
param as a manual-entry fallback so users on devices that can't scan can type
the secret in by hand.

Source: `packages/vue-aooth/src/components/as-qr-code.vue`.

```ts
interface AsQrCodeProps extends TAsComponentProps<string | undefined> {
  size?: number; // SVG width in px, default 192
  errorCorrection?: "L" | "M" | "Q" | "H"; // default "M"
  manualSecret?: boolean; // default true — hide the secret fallback for non-otpauth use cases
}
```

- The value is read as `props.value ?? props.model?.value`. Phantom
  registrations (`ui.paragraph` + `@ui.form.fn.value`) push through
  `props.value`; data-bound fields use `model.value`.
- `qrcode` is an **optional peer dependency** — install it in the consumer app
  when you ship a flow that uses `AsQrCode`. The module is dynamic-imported,
  so apps without the dep don't pay the bundle cost.

```bash
npm install qrcode
```

```atscript
@meta.label 'Scan with your authenticator app'
@ui.form.fn.value '(v, data, ctx) => ctx.totpUri'
@ui.form.component 'qr-code'
totpUri: ui.paragraph
```

When the value is an `otpauth://` URI, the parsed secret is rendered beneath
the SVG as plain text — set `:manualSecret="false"` when surfacing the secret
defeats the threat model (e.g. screen-sharing demos).

## AsCopy

Phantom field that surfaces a one-shot string with a read-only input and a
Copy button. Click writes through `navigator.clipboard.writeText` and swaps the
button label to "Copied" for ~1.5 s; focusing the input selects the full value
for fallback Ctrl+C / Cmd+C copy.

Source: `packages/vue-aooth/src/components/as-copy.vue`.

```ts
interface AsCopyProps extends TAsComponentProps<string | undefined> {
  copyLabel?: string; // default "Copy"
  copiedLabel?: string; // default "Copied"
}
```

- Value is read as `props.value ?? props.model?.value`, same phantom +
  data-bound dual-mode as `AsQrCode`.
- Failed clipboard writes (no permission, no API) flip the button back and
  surface "Copy failed — select and copy manually" through the field's error
  slot.

```atscript
@meta.label 'Magic link'
@ui.form.fn.value '(v, data, ctx) => ctx.magicLink'
@ui.form.component 'copy'
magicLink: ui.paragraph
```

Use it for magic links, share tokens, generated identifiers — any one-off
value the user needs to paste somewhere else.

## Phantom vs data-bound

`AsQrCode` and `AsCopy` are most useful as **phantom** fields backed by
context. The pattern combines three pieces:

1. The field type is `ui.paragraph` so the form treats it as non-data chrome —
   nothing is read or written on submit.
2. `@ui.form.fn.value '(v, data, ctx) => ctx.someKey'` supplies the displayed
   value from the form context.
3. `@wf.context.pass 'someKey'` (on workflow forms) opts the key into the
   client form context — without it, `ctx.someKey` is `undefined`.

Worked example for a workflow form rendering both at once:

```atscript
@wf.context.pass 'totpUri'
@wf.context.pass 'magicLink'
@meta.label 'Activate TOTP & share invite link'
@ui.form.submit.text 'Continue'
export interface QrCopyDemoForm {
    @meta.label 'Scan with your authenticator app'
    @ui.form.fn.value '(v, data, ctx) => ctx.totpUri'
    @ui.form.component 'qr-code'
    totpUri: ui.paragraph

    @meta.label 'Magic link'
    @ui.form.fn.value '(v, data, ctx) => ctx.magicLink'
    @ui.form.component 'copy'
    magicLink: ui.paragraph
}
```

::: warning Field-level fn signature

Field-level `@ui.form.fn.*` callbacks are `(v, data, ctx, entry)`. The
two-argument shape `(_, ctx) => ...` is **wrong** — the second argument is
`data`, not the context, and `ctx` would silently resolve to the current
form-data object. Only **form-level** keys
(`@ui.form.fn.title`, `@ui.form.fn.submit.text`, `@ui.form.fn.submit.disabled`)
use `(data, ctx)`. See [Dynamic Fields](/forms/dynamic-fields#scope-passed-to-every-function).
:::

When the value should land in the bound data slot (typed columns, downstream
serialization), use a **data field** with `@meta.readonly` + `@ui.form.fn.value`
instead. `AsField` resolves the function and writes the result into the bound
path through a watcher (see `packages/vue-form/src/components/as-field.vue`,
the "Readonly watcher" block around the `phantomValue` setup). Phantom is the
cleaner shape whenever the value is display-only.

## Cross-links

- [@atscript/vue-aooth](/api/vue-aooth) — package API reference
- [Custom Field Components](/forms/custom-components) — the underlying contract
- [Dynamic Fields](/forms/dynamic-fields) — `@ui.form.fn.*` reference
- [Workflows · Context Passing](/workflows/context) — `@wf.context.pass`
