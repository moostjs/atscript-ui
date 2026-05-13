# @atscript/vue-wf

Vue 3 client for the HTTP workflow loop. One component (`AsWfForm`) and one composable (`useWfForm`) that round-trip JSON-typed schemas with the server-side workflow runtime (see [`@atscript/moost-wf`](/api/moost-wf)). The server tells the client what to render and when the flow is done; the client renders via `@atscript/vue-form` and ships submissions back.

## Contents

- [Subpath](#subpath)
- [Component — AsWfForm](#component-aswfform)
- [Composable — useWfForm](#composable-usewfform)
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
}
```

### Slots

| Slot          | Scope                                             | Purpose                                                                                                                                                                                        |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| default       | `{ form, state, actions }`                        | Wraps everything below — opt into a fully custom shell. `form` = `{ def, formData, formContext }`, `state` = `{ loading, error, finished, response }`, `actions` = `{ start, submit, retry }`. |
| `wf.loading`  | —                                                 | First-load placeholder (only fires before the first FormDef arrives).                                                                                                                          |
| `wf.error`    | `{ error, retry }`                                | Transport / 4xx fallback shown when there's no form yet.                                                                                                                                       |
| `wf.finished` | `{ response }`                                    | Terminal state.                                                                                                                                                                                |
| `form.error`  | `{ error, retry }`                                | Server-supplied form-level error (rendered alongside the form).                                                                                                                                |
| `form.header` | AsForm's `form.header` slot props + `{ loading }` | Form chrome above the fields.                                                                                                                                                                  |
| `form.before` | AsForm's `form.before` slot props + `{ loading }` | Above the field tree.                                                                                                                                                                          |
| `form.after`  | AsForm's `form.after` slot props + `{ loading }`  | Below the field tree.                                                                                                                                                                          |
| `form.submit` | AsForm's `form.submit` slot props + `{ loading }` | Replace the submit button. Default: `<button :disabled="loading">{{ text }}</button>`.                                                                                                         |
| `form.footer` | AsForm's `form.footer` slot props + `{ loading }` | Below the submit row.                                                                                                                                                                          |

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
    <template #wf.finished="{ response }">
      <p>Welcome back, {{ response.user.email }}!</p>
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
