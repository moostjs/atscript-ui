# @atscript/vue-wf

Vue 3 client for the HTTP workflow loop. One component (`AsWfForm`) and one composable (`useWfForm`) that round-trip JSON-typed schemas with the server-side workflow runtime (see [`@atscript/moost-wf`](/api/moost-wf)). The server tells the client what to render and when the flow is done; the client renders via `@atscript/vue-form` and ships submissions back.

## Contents

- [Subpath](#subpath)
- [Component — AsWfForm](#component-aswfform)
- [Exposed instance methods](#exposed-instance-methods)
- [Composable — useWfForm](#composable-usewfform)
- [Error resolution](#error-resolution)
- [Types](#types)

## Subpath

```typescript
// barrel
import { AsWfForm, useWfForm } from "@atscript/vue-wf";

// isolated component (for granular bundling)
import AsWfForm from "@atscript/vue-wf/as-wf-form";
```

`AsResolver()` from [`@atscript/ui-styles`](/api/ui-styles) auto-imports `AsWfForm`.

## Component — AsWfForm

Wraps `useWfForm` and `<AsForm>`. Owns the entire workflow lifecycle — start, render, submit, action, error, finished. Slot-customizable for loading / error / finished branches.

### Props

```typescript
interface AsWfFormProps {
  /** HTTP endpoint for the workflow trigger. */
  path: string;
  /** Workflow id to start (e.g. "auth/login"). */
  name: string;
  /** Initial input sent with the first POST. */
  input?: Record<string, unknown>;
  /**
   * Token transport.
   * - "body"   (default) — token travels inside the JSON envelope.
   * - "cookie" — token rides Set-Cookie / Cookie.
   * - "query"  — token read from the URL (for email magic links).
   */
  tokenTransport?: "body" | "cookie" | "query";
  /** Token parameter name. Default `"wfs"`. */
  tokenName?: string;
  /** Workflow id parameter name. Default `"wfid"`. */
  wfidName?: string;
  /** Additional `RequestInit` merged into every POST. */
  fetchOptions?: RequestInit;
  /** Custom fetch (e.g. for status-code bus hooks). Default `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Auto-start on mount. Default `true`. */
  autoStart?: boolean;
  /**
   * Pre-existing token to resume from — use when the token lives outside
   * `window.location.search` (Vue Router param, app state).
   */
  initialToken?: string;
  /** Type-to-component map for AsForm rendering. */
  types: TAsTypeComponents;
  /** First-validation strategy. */
  firstValidation?: TFormState["firstValidation"];
  /** Custom components map forwarded to AsForm. */
  components?: Record<string, Component>;
  /** Per-form value-help client factory. */
  clientFactory?: ClientFactory;
  /** Forwarded to `<AsForm>`. Suppress the root field's title only (the description still renders). */
  hideRootTitle?: boolean;
  /** Forwarded to `<AsForm>`. Suppress the default submit button. */
  hideSubmit?: boolean;
  /**
   * Forwarded to `<AsWfFinish>`. Invoked with the redirect target URL when a
   * `redirect` action fires. Pairs with `@atscript/db-client`'s
   * `Client({ navigate })` so one handler covers both.
   */
  navigate?: (url: string) => void | Promise<void>;
}
```

### Emits

```typescript
{
  finished: (response: unknown) => void;
  error:    (error: { message: string; status?: number }) => void;
  form:     (def: FormDef, context?: Record<string, unknown>) => void;
  submit:   (data: unknown) => void;
  loading:  (isLoading: boolean) => void;
  // Fired by the default AsWfFinish screen — see Finish Screens.
  dismiss:  () => void;
  action:   (action: WfActionRequest) => void;
}
```

### Slots

| Slot           | Scope                      | Purpose                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| default        | `{ form, state, actions }` | Wraps everything below — opt into a fully custom shell. `form` = `{ def, formData, formContext }`, `state` = `{ loading, error, finished, response }`, `actions` = `{ start, submit, retry, action, supportsAction }` — `action(name, data?)` fires a workflow action, `supportsAction(name)` gates it against the current step (see [Exposed instance methods](#exposed-instance-methods)). |
| `wf.loading`   | —                          | First-load placeholder (only fires before the first FormDef arrives).                                                                                                                                                                                                                                                                                                                        |
| `wf.error`     | `{ error, retry }`         | Transport / 4xx error. Renders both before a form loads AND as a banner above a mounted form.                                                                                                                                                                                                                                                                                                |
| `wf.finished`  | `{ response, payload }`    | Terminal state. `payload` is the typed `WfFinished` envelope. See [Finish Screens](/workflows/finish-screens) for the `wf.finish.*` sub-slots.                                                                                                                                                                                                                                               |
| `form.header`  | AsForm `slotProps` bag     | Form chrome above the fields.                                                                                                                                                                                                                                                                                                                                                                |
| `form.before`  | AsForm `slotProps` bag     | Above the field tree.                                                                                                                                                                                                                                                                                                                                                                        |
| `form.after`   | AsForm `slotProps` bag     | Below the field tree.                                                                                                                                                                                                                                                                                                                                                                        |
| `form.error`   | bag + `message`, `dismiss` | AsForm's own form-level error banner (distinct from the transport-level `wf.error`).                                                                                                                                                                                                                                                                                                         |
| `form.submit`  | bag + `text`               | Replace the submit button.                                                                                                                                                                                                                                                                                                                                                                   |
| `form.footer`  | AsForm `slotProps` bag     | Below the submit row.                                                                                                                                                                                                                                                                                                                                                                        |
| `form.loading` | AsForm `slotProps` bag     | Contents of the loading overlay.                                                                                                                                                                                                                                                                                                                                                             |

The `form.*` slots are forwarded verbatim to the inner `<AsForm>`, so each
carries that component's unified `slotProps` bag — documented once in
[Forms — Slots & the slotProps bag](/forms/customization#slots-the-slotprops-bag).
The `wf.finish.*` sub-slots live on the [Finish Screens](/workflows/finish-screens)
page. For the narrative on every slot (with defaults and examples), see
[Client: AsWfForm](/workflows/client).

### Exposed instance methods

Reach these via a component `ref` (`const form = ref<InstanceType<typeof AsWfForm>>()`). The same two are mirrored in the `default` slot bag's `actions`. Lets a host fire a workflow action it renders itself — e.g. a dialog's own _Cancel_ button — without dropping `<AsWfForm>` for the headless [`useWfForm`](#composable-usewfform). See [Calling actions from the client](/workflows/actions#calling-actions-from-the-client) for the pattern.

```typescript
/** Fire the named workflow action. Auto-classifies: a `@wf.action.withData` action sends the current form payload; a plain `@ui.form.action` action sends none. */
action(name: string, data?: unknown): void;
/** `true` only when the current step's form declares that action id (`@ui.form.action` id ∪ `@wf.action.withData` value). Gate the host affordance on this — firing an undeclared action is rejected server-side. */
supportsAction(name: string): boolean;
```

### Example

```vue
<script setup lang="ts">
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const types = createDefaultTypes();
</script>

<template>
  <AsWfForm
    path="/api/auth/flow"
    name="auth/login"
    :types="types"
    @finished="onLogin"
    @error="onError"
  >
    <template #wf.finished="{ payload }">
      <p>Welcome back, {{ payload?.data?.user?.email }}!</p>
    </template>
  </AsWfForm>
</template>
```

## Composable — useWfForm

The HTTP loop without the renderer. Call it from a custom component when you want fully bespoke chrome but the same round-trip semantics.

```typescript
function useWfForm(options: UseWfFormOptions): UseWfFormReturn;
```

### `UseWfFormOptions`

```typescript
interface UseWfFormOptions {
  path: string;
  name: string;
  input?: Record<string, unknown>;
  tokenTransport?: "body" | "cookie" | "query";
  tokenName?: string;
  wfidName?: string;
  fetchOptions?: RequestInit;
  fetch?: typeof fetch;
  autoStart?: boolean;
  initialToken?: string;
}
```

### `UseWfFormReturn`

```typescript
interface UseWfFormReturn {
  /** Current form schema. `null` when there is no inputRequired pause. */
  formDef: ShallowRef<FormDef | null>;
  /** Reactive form data container `{ value: domainData }`. Null between pauses. */
  formData: ShallowRef<Record<string, unknown> | null>;
  /** Whitelisted server context (`@wf.context.pass`). */
  formContext: ShallowRef<Record<string, unknown>>;
  /** Server-supplied field errors. */
  errors: ShallowRef<Record<string, string>>;
  /** Incremented on every schema change — use as `:key` on `<AsForm>` for clean remounts. */
  formKey: Ref<number>;
  loading: Ref<boolean>;
  finished: Ref<boolean>;
  response: ShallowRef<unknown>;
  error: ShallowRef<unknown>;

  /** Begin the workflow (or resume from `initialToken`). */
  start: (input?: Record<string, unknown>) => Promise<void>;
  /** Submit the current form payload. */
  submit: (data: unknown) => Promise<void>;
  /** Dispatch a stateless action (no form payload). */
  action: (name: string) => Promise<void>;
  /** Dispatch an action that ships partial form data. */
  actionWithData: (name: string, data: unknown) => Promise<void>;
  /** Re-issue the last request — used by the default error retry button. */
  retry: () => Promise<void>;
}
```

### Behaviour notes

- **Outlet pauses** (`{ sent: true }` / `{ outlet: 'email' }`) are treated as `finished` — the current client's role is done; someone else resumes via the token.
- **Re-validation** is detected by hashing the `inputRequired.payload`. Identical schemas keep the same FormDef and `formData` reference; new schemas force a remount via `formKey`.
- **AbortController** is created per request and cancelled when a newer request starts or the component unmounts — no race conditions during quick action chains.
- **`initialToken`** takes precedence over `tokenTransport: "query"` auto-detection so Router-level params win over query strings.

### Custom-shell example

```vue
<script setup lang="ts">
import { useWfForm } from "@atscript/vue-wf";
import { AsForm, createDefaultTypes } from "@atscript/vue-form";

const wf = useWfForm({ path: "/api/auth/flow", name: "auth/login" });
const types = createDefaultTypes();

function onSubmit(data: unknown) {
  wf.submit(data);
}
</script>

<template>
  <div v-if="wf.loading.value && !wf.formDef.value">Loading…</div>
  <p v-else-if="wf.finished.value">Done.</p>
  <AsForm
    v-else-if="wf.formDef.value && wf.formData.value"
    :key="wf.formKey.value"
    :def="wf.formDef.value"
    :form-data="wf.formData.value"
    :form-context="wf.formContext.value"
    :errors="wf.errors.value"
    :types="types"
    @submit="onSubmit"
  />
</template>
```

## Error resolution

When a request returns a non-2xx response, `error.value` is set to `{ message, status }`. The message is resolved from the response body in this priority order:

1. `body.message` — the human-readable application intent. This is what `HttpError(status, message)` ships as `body.message` across the Wooks/Moost stack.
2. `body.error` — fallback when `message` is absent. The workflow-trigger engine emits `{ error: "Invalid or expired workflow state" }` (and similar) when state tokens are consumed or expired — this clause picks those up.
3. A friendly message keyed off the HTTP status code — used when the body is missing, empty, or has neither field. Examples:
   - `401` → "You need to sign in to continue."
   - `403` → "You don't have permission to do that."
   - `410` → "This session has expired. Please start over."
   - `429` → "Too many requests. Please wait a moment and try again."
   - Unmapped 4xx → "Something went wrong with that request. Please try again."
   - Any 5xx → "Something went wrong on our end. Please try again in a moment."

`message` wins over `error` because, in a wooksjs `HttpError` envelope, `error` carries the HTTP reason phrase mechanically derived from the status (`"Forbidden"`, `"Conflict"`), while `message` carries the application's intended user-facing copy.

`error.value.status` is the HTTP status code regardless of which clause supplied the message. Network failures (no response, non-`AbortError` exceptions) surface as `{ message }` with no `status` field.

## Types

`UseWfFormOptions` and `UseWfFormReturn` are exported from the package root. Re-export `FormDef` / `TAsTypeComponents` / `ClientFactory` from their owning packages — `@atscript/vue-wf` only re-exports its own surface.

## Cross-links

- [Workflows — Overview](/workflows/)
- [Workflows — Hello World](/workflows/hello-world)
- [Workflows — Server Authoring](/workflows/server-authoring)
- [Workflows — Form Input](/workflows/form-input)
- [Workflows — Actions](/workflows/actions), [Context Passing](/workflows/context)
- [Workflows — Outlets & Resume](/workflows/outlets-resume), [State Persistence](/workflows/state-persistence)
- [Workflows — AsWfForm](/workflows/client), [Recipes](/workflows/recipes)
- [@atscript/moost-wf](/api/moost-wf) — server runtime
- [@atscript/vue-form](/api/vue-form) — underlying form renderer
