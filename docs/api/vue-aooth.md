# @atscript/vue-aooth

Custom Vue 3 form-field components for [Aooth](https://aooth.moost.org)-flavoured flows — multi-consent collection, password-policy display, QR-code enrolment, one-shot link/token sharing, and SSO / social-login provider picking. All five implement the `TAsComponentProps` contract from [`@atscript/vue-form`](/api/vue-form) and drop into `<AsForm :components>` via the `@ui.form.component` annotation. Typically paired with [`@atscript/vue-wf`](/api/vue-wf) when the consents, policies, TOTP URIs, or magic links arrive as part of a workflow `formContext`.

## Contents

- [Subpath](#subpath)
- [Component — AsConsentArray](#component-asconsentarray)
- [Component — AsPasswordRules](#component-aspasswordrules)
- [Component — AsQrCode](#component-asqrcode)
- [Component — AsCopy](#component-ascopy)
- [Component — AsSsoProviders](#component-asssoproviders)
- [Custom-component patterns used](#custom-component-patterns-used)

## Subpath

```typescript
// barrel
import {
  AsConsentArray,
  AsCopy,
  AsPasswordRules,
  AsQrCode,
  AsSsoProviders,
} from "@atscript/vue-aooth";

// per-component (for granular bundling)
import AsConsentArray from "@atscript/vue-aooth/as-consent-array";
import AsCopy from "@atscript/vue-aooth/as-copy";
import AsPasswordRules from "@atscript/vue-aooth/as-password-rules";
import AsQrCode from "@atscript/vue-aooth/as-qr-code";
import AsSsoProviders from "@atscript/vue-aooth/as-sso-providers";

// descriptor types (prop payload item shapes)
import type { AsConsentArrayItem, AsPasswordRulesPolicy, AsSsoProvider } from "@atscript/vue-aooth";
```

None of the five are auto-resolved — all are Tier-2 swap targets. Register them by name in `<AsForm :components>` and tag the field with `@ui.form.component`. The narrative guide with end-to-end examples lives at [Forms · Aooth components](/forms/aooth-components).

The descriptor types behind the custom props are exported too — use them to type the lists you place on `formContext`:

- `AsConsentArrayItem` — one `pendingConsents` entry for [`AsConsentArray`](#component-asconsentarray).
- `AsPasswordRulesPolicy` — one `policies` entry for [`AsPasswordRules`](#component-aspasswordrules).
- `AsSsoProvider` — one `providers` entry for [`AsSsoProviders`](#component-asssoproviders).

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
    @ui.form.fn.attr 'pendingConsents', '(_v, _d, ctx) => ctx.pendingConsents'
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
    @ui.form.fn.attr 'policies', '(_v, _d, ctx) => ctx.passwordPolicies'
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

## Component — AsSsoProviders

SSO / social-login provider picker. Renders providers as a main stack of full-width buttons; any provider flagged `secondary: true` drops below an "or" divider as a compact chip. Each provider button is a one-click action — clicking selects the provider (writes its id to the bound model) _and_ fires the field's `@ui.form.action` in a single click, so there is no separate submit button. The bound value is the selected provider id. When the source list is empty the entire field is suppressed.

### Props

`TAsComponentProps<string | undefined>` with one custom prop fed via `@ui.form.attr` / `@ui.form.fn.attr`:

```typescript
interface AsSsoProvider {
  /** Committed to the bound model (`model.value = id`) on click and carried by the fired form action. */
  id: string;
  /**
   * Rendered VERBATIM. The backend owns the full display string (e.g.
   * "Continue with Google" for a main-stack button, "Discord" for a
   * secondary chip). The component never composes a "Continue with {name}" prefix.
   */
  text: string;
  /**
   * Optional CSS class painting the brand glyph (e.g. `i-logos-google-icon`).
   * Applied as-is; the consumer owns the icon collection / safelist coverage,
   * same contract as `prefixIcon`.
   */
  icon?: string;
  /**
   * `true` ⇒ renders as a compact chip below the "or" divider; omitted / false
   * ⇒ renders as a full-width button in the main stack (the default).
   */
  secondary?: boolean;
}

interface AsSsoProvidersProps extends TAsComponentProps<string | undefined> {
  providers?: AsSsoProvider[];
}
```

### Behaviour

- One-click contract: a click sets `model.value = provider.id` then emits the form `action` declared by `@ui.form.action` on the field. `<AsForm>` surfaces it as `@action(name, data)` with the selected provider already in `data`. Without a wired `@ui.form.action` the click still commits the id but emits nothing.
- Providers default to the prominent main stack (full-width buttons); only `secondary: true` opts into the compact chip group below the "or" divider. The "or" divider renders only when _both_ groups are non-empty — a lone group never dangles a divider.
- `text` is rendered verbatim. The component never prefixes "Continue with …"; the backend supplies the complete string per provider.
- `icon` is applied as-is. Icon classes referenced from `.as` files aren't seen by the static class extractor, so safelist whatever collection you ship.
- Empty or missing `providers` hides the whole field — the same render-only-when-the-backend-supplied-providers pattern as `AsConsentArray`. This also guards the transient first render before `@ui.form.fn.attr` resolves.
- No separate submit / "Continue" control: the component renders chromeless and suppresses the shell's footer action link, since the provider buttons themselves _are_ the action.

### How to wire

```atscript
// login-step.as
export interface LoginStep {
    @ui.form.component 'AsSsoProviders'
    @ui.form.action 'sso', 'Continue'
    @ui.form.fn.attr 'providers', '(_v, _d, ctx) => ctx.ssoProviders'
    ssoProvider?: string
}
```

The provider list comes from the form's `formContext` — typically supplied by the backend through `<AsWfForm>`'s server round-trip, so the same field schema works whether you offer one provider or ten. In a workflow form, add `@wf.action.withData 'sso'` on the same field so the chosen `ssoProvider` is submitted with the action (the same mechanism `forgotPassword` uses to carry a typed value). An optional `ssoProvider?` won't block a password login that submits without one.

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { AsSsoProviders } from "@atscript/vue-aooth";
import { LoginStep } from "./login-step.as";

const { def, formData } = createAsFormDef(LoginStep);
const types = createDefaultTypes();
const components = { AsSsoProviders };

// In a real app, formContext is whatever the server sends back.
// Icon classes are whatever icon collection your app ships + safelists.
const formContext = {
  ssoProviders: [
    { id: "google", text: "Continue with Google", icon: "i-logos:google-logo" },
    { id: "discord", text: "Discord", icon: "i-logos:discord-logo", secondary: true },
  ],
};

function onAction(name: string, data: { ssoProvider?: string }) {
  // name === "sso"; data.ssoProvider is the clicked provider id, e.g. "google".
  console.log("SSO provider selected:", data.ssoProvider);
}
</script>

<template>
  <AsForm
    :def="def"
    :form-data="formData"
    :form-context="formContext"
    :types="types"
    :components="components"
    @action="onAction"
  />
</template>
```

## Custom-component patterns used

These components are production examples of the patterns documented in [Custom Field Components](/forms/custom-components):

- **`AsConsentArray`** demonstrates the "`useAsField` inside a custom component" pattern — registering an extra field-state rule alongside the one `<AsField>` already provides, so per-item required validation runs at submit alongside the schema-level pipeline.
- **`AsPasswordRules`** demonstrates the "re-use `compileFieldFn` for fn-string arrays" pattern — evaluating consumer-supplied policy rule strings through the framework's shared FNPool instead of allocating a private one.
- **`AsQrCode`** and **`AsCopy`** demonstrate the **phantom display field** pattern — `ui.paragraph` + `@ui.form.fn.value` reading from `formContext`, so a server-supplied value renders without ever entering the bound data.
- **`AsSsoProviders`** demonstrates emitting a **form action from a custom component** — one-click select + fire `@ui.form.action` in a single click — together with the `@wf.action.withData` data-carrying-action pattern for workflow forms.

## Cross-links

- [@atscript/vue-form](/api/vue-form) — the underlying form renderer
- [@atscript/vue-wf](/api/vue-wf) — pairs naturally for Aooth-driven workflow flows
- [@atscript/ui-fns](/api/ui-fns) — supplies `compileFieldFn`
- [Aooth](https://aooth.moost.org) — auth + RBAC for the Moost / atscript ecosystem
