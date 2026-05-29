# @atscript/vue-aooth

Custom Vue 3 form-field components for [Aooth](https://aooth.moost.org)-flavoured flows — multi-consent collection, password-policy display, QR-code enrolment, and one-shot link/token sharing. All four implement the `TAsComponentProps` contract from [`@atscript/vue-form`](/api/vue-form) and drop into `<AsForm :components>` via the `@ui.form.component` annotation. Typically paired with [`@atscript/vue-wf`](/api/vue-wf) when the consents, policies, TOTP URIs, or magic links arrive as part of a workflow `formContext`.

## Contents

- [Subpath](#subpath)
- [Component — AsConsentArray](#component-asconsentarray)
- [Component — AsPasswordRules](#component-aspasswordrules)
- [Component — AsQrCode](#component-asqrcode)
- [Component — AsCopy](#component-ascopy)
- [Custom-component patterns used](#custom-component-patterns-used)

## Subpath

```typescript
// barrel
import { AsConsentArray, AsCopy, AsPasswordRules, AsQrCode } from "@atscript/vue-aooth";

// per-component (for granular bundling)
import AsConsentArray from "@atscript/vue-aooth/as-consent-array";
import AsCopy from "@atscript/vue-aooth/as-copy";
import AsPasswordRules from "@atscript/vue-aooth/as-password-rules";
import AsQrCode from "@atscript/vue-aooth/as-qr-code";
```

None of the four are auto-resolved — all are Tier-2 swap targets. Register them by name in `<AsForm :components>` and tag the field with `@ui.form.component`. The narrative guide with end-to-end examples lives at [Forms · Aooth components](/forms/aooth-components).

## Component — AsConsentArray

Multi-consent checkbox group. The bound value is a `string[]` containing the ids of every checked consent. When the source list is empty, the entire field is suppressed — useful for "show the legal block only when the backend says it has new consents to collect".

### Props

Extends `TAsComponentProps<string[]>` with one custom prop fed via `@ui.form.fn.attr`:

```typescript
interface AsConsentArrayItem {
  /** Value committed to the bound `string[]` when checked. */
  id: string;
  /** Checkbox label. Supports `[text](url)` markdown links for http(s)/mailto URLs. */
  text: string;
  /**
   * Non-empty string ⇒ mandatory consent; the string is the surfaced
   * error message. Empty / undefined ⇒ optional.
   */
  required?: string;
}

interface AsConsentArrayProps extends TAsComponentProps<string[]> {
  pendingConsents?: AsConsentArrayItem[];
}
```

### Behaviour

- One row per `pendingConsents` entry. The whole shell is hidden when `pendingConsents` is empty or omitted.
- A required consent renders an asterisk marker on its label. Missing required consents surface their `required` message inline beneath the row (the shell-level error footer is suppressed to avoid duplication).
- Consent text is parsed for markdown links `[label](url)`. Only `http://`, `https://`, and `mailto:` URLs render as anchors; any other scheme falls back to the verbatim source string so dangerous schemes (e.g. `javascript:`) can't sneak through.
- Validation runs through `useAsField` — registered alongside the field-state entry `<AsField>` already provides, so all rules run at submit time and external errors propagate.
- The committed array preserves insertion order — checks append, unchecks remove. The display order follows `pendingConsents`.

### How to wire

```atscript
// auth-step.as
export interface SignupStep {
    @meta.label 'Email'
    @meta.required 'Email required'
    email: string.email

    @ui.form.component 'AsConsentArray'
    @ui.form.fn.attr 'pendingConsents', '(_, _, ctx) => ctx.pendingConsents'
    consents: string[]
}
```

The consents list comes from the form's `formContext` — typically supplied by the backend through `<AsWfForm>`'s server round-trip, so the same field schema works whether your backend ships one consent or ten.

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { AsConsentArray } from "@atscript/vue-aooth";
import { SignupStep } from "./auth-step.as";

const { def, formData } = createAsFormDef(SignupStep);
const types = createDefaultTypes();
const components = { AsConsentArray };

// In a real app, formContext is whatever the server sends back.
const formContext = {
  pendingConsents: [
    {
      id: "tos",
      text: "I accept the [Terms of Service](https://example.com/tos)",
      required: "Please accept the Terms",
    },
    { id: "marketing", text: "Send me product updates" },
  ],
};
</script>

<template>
  <AsForm
    :def="def"
    :form-data="formData"
    :form-context="formContext"
    :types="types"
    :components="components"
  />
</template>
```

## Component — AsPasswordRules

Display-only readout of password-policy fulfilment. Pair it with a sibling password field; the component re-evaluates on every password keystroke and toggles each row's met / unmet state.

### Props

`TAsComponentProps` (no value binding — the field is display-only, conventionally typed as `ui.paragraph` so the form treats it as non-data chrome) plus:

```typescript
interface AsPasswordRulesPolicy {
  /** Function-string evaluated through @atscript/ui-fns' compileFieldFn. */
  rule: string;
  /** Plain label shown to the user. */
  description?: string;
  /** Backend-supplied wording reserved for future submit-failure surfacing. */
  errorMessage?: string;
}

interface AsPasswordRulesProps extends TAsComponentProps {
  policies?: AsPasswordRulesPolicy[];
  /** Current password value — typically sourced from a sibling field. */
  password?: string;
}
```

### Behaviour

- Each policy row reads `data-passed="true" | "false"` — style the met / unmet glyph and text through descendant selectors on `.as-password-rules-row`.
- The `rule` string is compiled with `compileFieldFn` from `@atscript/ui-fns`, sharing the same FNPool cache the framework uses for `@ui.form.fn.*` annotations. Compiled rules are invoked positionally — the rule's first argument receives the current password.
- Empty password ⇒ all rows render as unpassed, regardless of what a no-op rule would technically return. This avoids misleading "all good!" cues at the empty-input state.
- A broken / throwing rule is treated as unpassed and logged once per distinct rule source (no console flooding on every keystroke).

### How to wire

```atscript
// password-step.as
export interface PasswordStep {
    @meta.label 'New password'
    @meta.required 'Password required'
    @ui.form.type 'password'
    newPassword: string

    @ui.form.type 'paragraph'
    @ui.form.component 'AsPasswordRules'
    @ui.form.fn.attr 'policies', '(_, _, ctx) => ctx.passwordPolicies'
    @ui.form.fn.attr 'password', '(_, data) => data.newPassword'
    passwordHints: string
}
```

`policies` is sourced from `formContext.passwordPolicies` (server-supplied, typically arriving via `<AsWfForm>`); `password` watches the live sibling value via `(_, data) => data.newPassword`. The compiled `rule` strings receive that password as their first argument.

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { AsPasswordRules } from "@atscript/vue-aooth";
import { PasswordStep } from "./password-step.as";

const { def, formData } = createAsFormDef(PasswordStep);
const types = createDefaultTypes();
const components = { AsPasswordRules };

const formContext = {
  passwordPolicies: [
    { rule: "(p) => p.length >= 8", description: "At least 8 characters" },
    { rule: "(p) => /[A-Z]/.test(p)", description: "At least one uppercase letter" },
    { rule: "(p) => /[0-9]/.test(p)", description: "At least one digit" },
  ],
};
</script>

<template>
  <AsForm
    :def="def"
    :form-data="formData"
    :form-context="formContext"
    :types="types"
    :components="components"
  />
</template>
```

## Component — AsQrCode

Phantom field that renders an SVG QR code from any string. Primarily used for TOTP enrolment: for `otpauth://` URIs it also surfaces the `?secret=` query param beneath the SVG as a manual-entry fallback for users who can't scan.

### Props

`TAsComponentProps<string | undefined>` plus:

```typescript
interface AsQrCodeProps extends TAsComponentProps<string | undefined> {
  /** SVG width in px. Default 192. */
  size?: number;
  /** QR error-correction level. Default "M". */
  errorCorrection?: "L" | "M" | "Q" | "H";
  /**
   * Show the parsed `?secret=` fallback for `otpauth://` values.
   * Default true — set false when surfacing the secret defeats the
   * threat model (e.g. screen-sharing demos).
   */
  manualSecret?: boolean;
}
```

### Behaviour

- The value is read as `props.value ?? props.model?.value`. Phantom registrations (`ui.paragraph` + `@ui.form.fn.value`) push through `props.value`; data-bound fields use `model.value`.
- `qrcode` is an **optional peer dependency** — install it in the consumer app only for flows that use `AsQrCode`. The module is dynamic-imported, so apps without the dep pay no bundle cost.
- For `otpauth://` URIs the parsed secret renders as plain text beneath the SVG unless `:manualSecret="false"`.

```bash
npm install qrcode
```

### How to wire

```atscript
// enrol-step.as
export interface EnrolStep {
    @meta.label 'Scan with your authenticator app'
    @ui.form.fn.value '(v, data, ctx) => ctx.totpUri'
    @ui.form.component 'AsQrCode'
    totpUri: ui.paragraph
}
```

`totpUri` is supplied from `formContext` (server-side via `@wf.context.pass 'totpUri'` on a workflow form). See [Phantom vs data-bound](/forms/aooth-components#phantom-vs-data-bound) for the full pattern.

## Component — AsCopy

Phantom field that surfaces a one-shot string with a read-only input and a Copy button. Click writes through `navigator.clipboard.writeText` and swaps the button label to "Copied" for ~1.5 s; focusing the input selects the full value for fallback Ctrl+C / Cmd+C copy.

### Props

`TAsComponentProps<string | undefined>` plus:

```typescript
interface AsCopyProps extends TAsComponentProps<string | undefined> {
  /** Idle button label. Default "Copy". */
  copyLabel?: string;
  /** Post-copy button label. Default "Copied". */
  copiedLabel?: string;
}
```

### Behaviour

- Value is read as `props.value ?? props.model?.value` — same phantom + data-bound dual mode as `AsQrCode`.
- Failed clipboard writes (no permission, no API) flip the button back and surface "Copy failed — select and copy manually" through the field's error slot.

### How to wire

```atscript
// share-step.as
export interface ShareStep {
    @meta.label 'Magic link'
    @ui.form.fn.value '(v, data, ctx) => ctx.magicLink'
    @ui.form.component 'AsCopy'
    magicLink: ui.paragraph
}
```

Use it for magic links, share tokens, generated identifiers — any one-off value the user needs to paste somewhere else.

## Custom-component patterns used

The four components are production examples of the patterns documented in [Custom Field Components](/forms/custom-components):

- **`AsConsentArray`** demonstrates the "`useAsField` inside a custom component" pattern — registering an extra field-state rule alongside the one `<AsField>` already provides, so per-item required validation runs at submit alongside the schema-level pipeline.
- **`AsPasswordRules`** demonstrates the "re-use `compileFieldFn` for fn-string arrays" pattern — evaluating consumer-supplied policy rule strings through the framework's shared FNPool instead of allocating a private one.
- **`AsQrCode`** and **`AsCopy`** demonstrate the **phantom display field** pattern — `ui.paragraph` + `@ui.form.fn.value` reading from `formContext`, so a server-supplied value renders without ever entering the bound data.

## Cross-links

- [@atscript/vue-form](/api/vue-form) — the underlying form renderer
- [@atscript/vue-wf](/api/vue-wf) — pairs naturally for Aooth-driven workflow flows
- [@atscript/ui-fns](/api/ui-fns) — supplies `compileFieldFn`
- [Aooth](https://aooth.moost.org) — auth + RBAC for the Moost / atscript ecosystem
