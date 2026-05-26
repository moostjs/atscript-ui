# client

`<AsWfForm>` props/emits/slots, `useWfForm()` composable, custom auth fetch, resume from URL.

## Contents

- [<AsWfForm> props](#aswfform-props)
- [Emits](#emits)
- [Slots](#slots)
- [useWfForm(options) composable](#usewfformoptions-composable)
- [UseWfFormOptions](#usewfformoptions)
- [Error message resolution](#error-message-resolution)
- [Auth — custom fetch override](#auth--custom-fetch-override)
- [Same-form re-validation behavior](#same-form-re-validation-behavior)
- [AbortController behavior](#abortcontroller-behavior)
- [Custom shell pattern](#custom-shell-pattern)
- [Recipe — minimal mount with custom slots](#recipe--minimal-mount-with-custom-slots)
- [Recipe — resume from URL parameter](#recipe--resume-from-url-parameter)
- [SSR considerations](#ssr-considerations)

## <AsWfForm> props

| Prop              | Type                            | Default            | Purpose                                                                                             |
| ----------------- | ------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| `path`            | `string`                        | (required)         | HTTP endpoint for the workflow trigger (e.g. `/api/wf/trigger`)                                     |
| `name`            | `string`                        | (required)         | Workflow id (`wfid`) to start (e.g. `'auth/login'`)                                                 |
| `input`           | `Record<string, unknown>`       | `undefined`        | Initial input sent with the `start` request                                                         |
| `tokenTransport`  | `'body' \| 'cookie' \| 'query'` | `'body'`           | Where to read / write the state token                                                               |
| `tokenName`       | `string`                        | `'wfs'`            | Token field name in JSON body / URL query                                                           |
| `wfidName`        | `string`                        | `'wfid'`           | Workflow-id field name in the JSON body                                                             |
| `fetchOptions`    | `RequestInit`                   | `{}`               | Static `fetch` options (headers, credentials, etc.) merged into every request                       |
| `fetch`           | `typeof fetch`                  | `globalThis.fetch` | Override `fetch` itself — for auth wrappers / status bus                                            |
| `autoStart`       | `boolean`                       | `true`             | Auto-call `start(input)` on mount                                                                   |
| `initialToken`    | `string`                        | `undefined`        | Pre-existing state token (resume). Takes precedence over `tokenTransport: 'query'` auto-detection   |
| `types`           | `TAsTypeComponents`             | (required)         | Type-to-component map for `AsForm` rendering (use `createDefaultTypes()` from `@atscript/vue-form`) |
| `firstValidation` | `TFormState['firstValidation']` | undefined          | First-validation strategy forwarded to `AsForm` (see `atscript-ui-forms` skill)                     |
| `components`      | `Record<string, Component>`     | undefined          | Custom components map forwarded to `AsForm`                                                         |
| `clientFactory`   | `ClientFactory`                 | undefined          | Per-form FK value-help client factory forwarded to `AsForm`                                         |

`path`, `name`, `types` are the only required props.

## Emits

| Event      | Signature                                                   | Fires when                                                                                                                |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `finished` | `(response: unknown) => void`                               | flow completes (`{ finished: true, ... }`) OR outlet pause (`{ sent: true }` / `{ outlet: '...' }`)                       |
| `error`    | `(error: { message: string; status?: number }) => void`     | network failure, non-2xx response, or `{ error: {...} }` body (see [Error message resolution](#error-message-resolution)) |
| `form`     | `(def: FormDef, context?: Record<string, unknown>) => void` | each time the rendered form / context changes (initial render, schema swap, re-validation)                                |
| `submit`   | `(data: unknown) => void`                                   | user submitted the form (fires **before** the HTTP request is sent)                                                       |
| `loading`  | `(isLoading: boolean) => void`                              | request lifecycle — `true` on send, `false` on response/error                                                             |

Side-effects are wired internally via watchers that translate composable refs to emits.

## Slots

All slots are typed via slot props.

### Default slot — full custom shell

```vue
<AsWfForm v-slot="{ form, state, actions }" path="..." name="..." :types>
  <!-- form: { def, formData, formContext } -->
  <!-- state: { loading, error, finished, response } -->
  <!-- actions: { start, submit, retry } -->
  <pre>{{ form.formContext }}</pre>
</AsWfForm>
```

| Slot prop | Shape                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `form`    | `{ def: FormDef \| null, formData: Record<string, unknown> \| null, formContext: Record<string, unknown> }` |
| `state`   | `{ loading: boolean, error: unknown, finished: boolean, response: unknown }`                                |
| `actions` | `{ start: (input?) => Promise<void>, submit: (data) => void, retry: () => Promise<void> }`                  |

When you supply the default slot's contents, you take over the entire layout. The component still ships the named slots below for the standard layout — opt-in by **omitting** the default slot.

### Workflow lifecycle slots

| Slot          | Slot props                                                                                                                               | When                                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wf.loading`  | (none)                                                                                                                                   | initial load (no form yet) — default fallback renders an `as-form-overlay` spinner inside a `min-h-[100px]` wrapper, matching the overlay shown between subsequent round-trips. Override only to swap in a custom indicator. |
| `wf.error`    | `{ error, retry }`                                                                                                                       | error before any form rendered                                                                                                                                                                                               |
| `wf.finished` | `{ response, payload }` — `payload: WfFinished \| null` is the typed envelope; `response` is the same data untyped, kept for back-compat | flow finished. Default renders `<AsWfFinish :payload>` — override to opt out and render fully custom.                                                                                                                        |

```vue
<AsWfForm ...>
  <template #wf.loading>
    <Spinner />
  </template>
  <template #wf.error="{ error, retry }">
    <ErrorBanner :error="error" />
    <button @click="retry">Try again</button>
  </template>
  <template #wf.finished="{ payload }">
    <SuccessPanel :envelope="payload" />
  </template>
</AsWfForm>
```

### Form-level slots — forwarded to inner AsForm

These pass through to the `AsForm` component (see `atscript-ui-forms` skill). The vue-wf wrapper adds `loading` to each slot prop.

| Slot          | Slot props (added)                       | Purpose                                                  |
| ------------- | ---------------------------------------- | -------------------------------------------------------- |
| `form.header` | `loading: boolean` + AsForm header props | above the form fields                                    |
| `form.before` | `loading` + AsForm before props          | between header and fields                                |
| `form.after`  | `loading` + AsForm after props           | between fields and submit                                |
| `form.submit` | `loading` + `disabled`, `text`, …        | replace the submit button entirely                       |
| `form.footer` | `loading` + AsForm footer props          | below the submit row                                     |
| `form.error`  | `{ error, retry }`                       | inline error inside the form (after a form has rendered) |

```vue
<AsWfForm ...>
  <template #form.submit="{ text, disabled, loading }">
    <button :disabled="disabled || loading" class="my-btn">
      <Spinner v-if="loading" /> {{ text }}
    </button>
  </template>
</AsWfForm>
```

## useWfForm(options) composable

Return shape:

```typescript
interface UseWfFormReturn {
  formDef: ShallowRef<FormDef | null>;
  formData: ShallowRef<Record<string, unknown> | null>;
  formContext: ShallowRef<Record<string, unknown>>;
  errors: ShallowRef<Record<string, string>>;
  /** Increments each time the form schema changes — use as :key on AsForm to force remount. */
  formKey: Ref<number>;
  loading: Ref<boolean>;
  finished: Ref<boolean>;
  response: ShallowRef<unknown>;
  error: ShallowRef<unknown>;
  start: (input?: Record<string, unknown>) => Promise<void>;
  submit: (data: unknown) => Promise<void>;
  action: (name: string) => Promise<void>;
  actionWithData: (name: string, data: unknown) => Promise<void>;
  retry: () => Promise<void>;
}
```

| Method                       | Sends                                | Purpose                                             |
| ---------------------------- | ------------------------------------ | --------------------------------------------------- |
| `start(input?)`              | `{ wfid, input?, wfs? }`             | start (or resume with `initialToken`) the flow      |
| `submit(data)`               | `{ wfs, input: data }`               | submit the current form                             |
| `action(name)`               | `{ wfs, action: name }`              | dispatch a plain action (no data)                   |
| `actionWithData(name, data)` | `{ wfs, action: name, input: data }` | dispatch a `@wf.action.withData` action             |
| `retry()`                    | last request body                    | replay the last failed request — see error recovery |

### State refs

| Ref           | Type                                          | Replaced when                                                                 |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `formDef`     | `ShallowRef<FormDef \| null>`                 | new payload arrives (different schema) — `null` on finished/outlet            |
| `formData`    | `ShallowRef<Record<string, unknown> \| null>` | new payload arrives — `null` on finished/outlet                               |
| `formContext` | `ShallowRef<Record<string, unknown>>`         | every response (with `errors` stripped)                                       |
| `errors`      | `ShallowRef<Record<string, string>>`          | every response (server-side validation errors, keyed by field path)           |
| `loading`     | `Ref<boolean>`                                | request lifecycle                                                             |
| `finished`    | `Ref<boolean>`                                | flow finished OR outlet pause                                                 |
| `response`    | `ShallowRef<unknown>`                         | finished body                                                                 |
| `error`       | `ShallowRef<unknown>`                         | error body or network failure                                                 |
| `formKey`     | `Ref<number>`                                 | bumps when payload changes — bind to `:key` on rendered form to force remount |

`AsWfForm` already binds `formKey` to its inner `AsForm`. When building a custom shell, do the same.

## UseWfFormOptions

```typescript
interface UseWfFormOptions {
  path: string;
  name: string;
  input?: Record<string, unknown>;
  tokenTransport?: "body" | "cookie" | "query";
  tokenName?: string; // default "wfs"
  wfidName?: string; // default "wfid"
  fetchOptions?: RequestInit;
  fetch?: typeof fetch;
  autoStart?: boolean; // default true
  initialToken?: string;
}
```

Options mirror `<AsWfForm>` props (minus rendering-related `types`, `firstValidation`, `components`, `clientFactory`).

## Error message resolution

On a non-2xx response the composable sets `error.value` to `{ message, status }`. The message is resolved from the JSON body in this order:

1. `body.message` — application intent. Wooksjs `HttpError(status, message)` puts the user-facing copy here.
2. `body.error` — fallback. The wf-trigger engine emits `{ error: "Invalid or expired workflow state" }` for expired/consumed state tokens.
3. Friendly status-keyed default (e.g. `410` → "This session has expired. Please start over.", `403` → "You don't have permission to do that."). Unmapped 4xx fall through to a generic 4xx string; any 5xx collapses to a generic "try again" string.

`message` wins over `error` because in a wooksjs `HttpError` envelope `error` carries the HTTP reason phrase (`"Forbidden"`, `"Conflict"`) while `message` carries the backend's user-facing copy.

`error.value.status` is the HTTP status code regardless of which clause supplied the message. Network failures (no response, non-`AbortError` exceptions) surface as `{ message }` with no `status` field.

## Auth — custom fetch override

For Bearer tokens and other auth schemes, supply a custom `fetch`:

```typescript
import type { UseWfFormOptions } from "@atscript/vue-wf";

function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const token = getAuthToken();
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
```

```vue
<AsWfForm :fetch="authedFetch" path="/api/wf/trigger" name="auth/login" :types />
```

The override receives the **fully-built** `RequestInit` (method, body, signal, etc. all set). Don't strip those — merge.

Use cases for `fetch` override beyond auth:

- Status-code bus — emit on `on401` / `on410` for app-wide expiry banners.
- Distributed tracing — inject trace headers.
- Mocking in tests — feed canned responses without spinning up a server.

For static header sets (no per-request logic), `fetchOptions: { headers: {...}, credentials: 'include' }` is simpler.

## Same-form re-validation behavior

Client compares `JSON.stringify(ir.payload)` between successive responses. Three outcomes:

| Comparison                                     | Effect                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| Same payload (re-validation)                   | preserve `formData`, render new `errors`, `formKey` unchanged             |
| Different payload (new step)                   | rebuild `formDef`, fresh `formData`, **bump `formKey`** → AsForm remounts |
| No `inputRequired` (finished / outlet / error) | `formDef = null`, `formData = null`                                       |

Why: when the server rejects a submit and re-sends the same form, the user's typed values must stay on screen. The deep-equality check on the serialized payload is the trigger.

Caveat: re-validating with a payload that differs only in `@wf.context.pass` keys still counts as "different" — because `serializeFormSchema` strips those before sending. Wire identity holds for the same form-type identity.

## AbortController behavior

`useWfForm` keeps one `AbortController` per round-trip:

- Each `post()` aborts the previous in-flight controller before starting a new one.
- `onUnmounted` aborts on component unmount.
- `AbortError` from `fetch` is silently swallowed (not surfaced as `error`).

Implication: user typing fast and triple-submitting → only the last request actually runs to completion; earlier ones abort silently.

## Custom shell pattern

When the default `AsWfForm` layout is too rigid (custom progress bar, multi-flow stepper, embedded sub-flows), drive a custom shell with `useWfForm`:

```vue
<script setup lang="ts">
import { useWfForm } from "@atscript/vue-wf";
import { AsForm, createDefaultTypes } from "@atscript/vue-form";

const props = defineProps<{ path: string; name: string }>();
const types = createDefaultTypes();
const wf = useWfForm({ path: props.path, name: props.name });
</script>

<template>
  <div class="my-wf-shell">
    <ProgressBar :step="..." />

    <Spinner v-if="wf.loading.value && !wf.formDef.value" />

    <FinishedPanel v-else-if="wf.finished.value" :response="wf.response.value" />

    <AsForm
      v-else-if="wf.formDef.value && wf.formData.value"
      :key="wf.formKey.value"
      :def="wf.formDef.value"
      :form-data="wf.formData.value"
      :types
      :errors="wf.errors.value"
      :form-context="wf.formContext.value"
      :loading="wf.loading.value"
      @submit="wf.submit"
      @action="wf.action"
    />

    <ErrorBanner v-if="wf.error.value" :error="wf.error.value" @retry="wf.retry" />
  </div>
</template>
```

Things `AsWfForm` does for you that you must replicate in a custom shell:

- Bind `:key="wf.formKey.value"` on `AsForm` — without this, same-form re-validation will **not** preserve user input (the diff still bumps the key on schema change; you must wire that to remount).
- Classify actions: `@wf.action.withData` actions need `actionWithData(name, data)`, plain actions need `action(name)`. The reference component reads `WF_ACTION_WITH_DATA` from `getFieldMeta` to build the set.
- Forward `clientFactory` if your forms have FK pickers.

## Recipe — minimal mount with custom slots

```vue
<script setup lang="ts">
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";
const types = createDefaultTypes();
</script>

<template>
  <AsWfForm path="/wf/trigger" name="hello" :types>
    <template #wf.loading>
      <div class="my-loader">Starting…</div>
    </template>
    <template #wf.error="{ error, retry }">
      <div class="my-error">
        Something went wrong.
        <button @click="retry">Retry</button>
      </div>
    </template>
    <template #wf.finished="{ response }">
      <div class="my-success">Done: {{ JSON.stringify(response) }}</div>
    </template>
  </AsWfForm>
</template>
```

## Recipe — resume from URL parameter

Pattern 1 — Vue Router query param (`/resume?wfs=<token>`):

```vue
<script setup lang="ts">
import { useRoute } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const route = useRoute();
const types = createDefaultTypes();
const token = (route.query.wfs as string) || undefined;
</script>

<template>
  <AsWfForm path="/api/wf/trigger" name="auth/magic-link" :initialToken="token" :types />
</template>
```

Pattern 2 — Vue Router path param (`/invite/:token`):

```vue
<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
const token = route.params.token as string;
</script>

<template>
  <AsWfForm path="/api/wf/trigger" name="admin/invite" :initialToken="token" :types />
</template>
```

`initialToken` always wins. Use it whenever the token comes from somewhere other than `window.location.search` — router params, app state, postMessage, etc.

Pattern 3 — auto-detect from URL (`tokenTransport: 'query'` only):

```vue
<AsWfForm path="/api/wf/trigger" name="auth/magic-link" tokenTransport="query" :types />
```

The composable reads `?wfs=<token>` from `window.location.search` once on `start()`. Skip `initialToken` for this auto-detection path.

## SSR considerations

`<AsWfForm>` calls `start(input)` from `onMounted` by default, which `fetch`es `path` to retrieve the first form schema. Under SSR that runs at hydration time on the client — but if a parent component mounts a child `<AsWfForm>` during server rendering (e.g. inside an `<Suspense>` boundary that awaits child effects), the `fetch` will fire in Node and either crash (no `globalThis.fetch` polyfill) or hit your own server from itself.

Two equivalent guards — pick whichever fits the surrounding code:

```vue
<!-- 1. Set autoStart="false" and trigger explicitly after hydration. -->
<AsWfForm v-slot="{ actions }" path="/wf" name="…" :types :auto-start="false">
  <button @click="actions.start()">Begin</button>
</AsWfForm>

<!-- 2. v-if gate on a client-only ref (Vite SSR, Nuxt, etc.). -->
<AsWfForm v-if="hydrated" path="/wf" name="…" :types />
```

```ts
// hydrated.ts
import { onMounted, ref } from "vue";
export function useHydrated() {
  const hydrated = ref(false);
  onMounted(() => (hydrated.value = true));
  return hydrated;
}
```

The same applies to `useWfForm()` directly — pass `autoStart: false` and call `start()` from a client-only callback (`onMounted`, route navigation guard, etc.). The component's `<AsForm>` shell is SSR-safe — it just has nothing to render until `formDef` is populated.
