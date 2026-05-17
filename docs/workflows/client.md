---
outline: deep
---

# Client: AsWfForm

The Vue 3 mount point. `<AsWfForm>` is a Tier-1 component
(auto-imported by `AsResolver`) that owns the HTTP round-trip and
delegates rendering to `<AsForm>`. For full control over the chrome,
drop down to the underlying `useWfForm()` composable.

## Minimal mount

```vue
<script setup lang="ts">
import { AsWfForm } from "@atscript/vue-wf";
import { createDefaultTypes } from "@atscript/vue-form";

const types = createDefaultTypes();

function onFinished(response: unknown) {
  // response = { finished: true, ...value } — the marker is supplied by
  // handleAsOutletRequest; `value` is what useWfFinished().set({ value })
  // passed from the step.
}
</script>

<template>
  <AsWfForm path="/api/wf" name="auth/login" :types="types" @finished="onFinished" />
</template>
```

That's the entire integration: pick a path, name the workflow,
provide the type map, listen for the completion event.

## Props

```ts
interface AsWfFormProps {
  // ── Required ───────────────────────────────────────────────
  /** HTTP endpoint for the workflow trigger. */
  path: string;
  /** Workflow ID to start (the @Workflow("...") id on the server). */
  name: string;
  /** Type-to-component map for AsForm. Usually `createDefaultTypes()`. */
  types: TAsTypeComponents;

  // ── Token transport ────────────────────────────────────────
  /** "body" (default) | "cookie" | "query". */
  tokenTransport?: "body" | "cookie" | "query";
  /** Token parameter name. Default "wfs". */
  tokenName?: string;
  /** Workflow ID parameter name. Default "wfid". */
  wfidName?: string;
  /** Pre-existing token to resume from (e.g. Vue Router param). */
  initialToken?: string;

  // ── HTTP options ───────────────────────────────────────────
  /** Initial input sent with the first request. */
  input?: Record<string, unknown>;
  /** Custom fetch options (headers, credentials, AbortSignal). */
  fetchOptions?: RequestInit;
  /** Override the global fetch — for auth interceptors / status buses. */
  fetch?: typeof fetch;
  /** Auto-start on mount. Default true. */
  autoStart?: boolean;

  // ── AsForm forwarding ──────────────────────────────────────
  /** First-validation strategy. See Forms / Validation. */
  firstValidation?: TFormState["firstValidation"];
  /** Custom component map (named overrides). */
  components?: Record<string, Component>;
  /** Per-form client factory (FK value-help). */
  clientFactory?: ClientFactory;
}
```

Defaults set at the component:

| Prop             | Default  |
| ---------------- | -------- |
| `autoStart`      | `true`   |
| `tokenTransport` | `"body"` |
| `tokenName`      | `"wfs"`  |
| `wfidName`       | `"wfid"` |

## Emits

```ts
defineEmits<{
  (e: "finished", response: unknown): void;
  (e: "error", error: { message: string; status?: number }): void;
  (e: "form", def: FormDef, context?: Record<string, unknown>): void;
  (e: "submit", data: unknown): void;
  (e: "loading", isLoading: boolean): void;
  // Fired by the default AsWfFinish screen when a WfFinished envelope's
  // `end` triggers an action. See "Finish Screens".
  (e: "navigate", payload: { target: string; mode: "soft" | "hard"; reason?: string }): void;
  (e: "dismiss"): void;
  (e: "action", action: WfAction): void;
}>();
```

- **`@finished`** — flow completed (`{ finished: true, ... }`) or
  paused via outlet (`{ sent: true }`). Fires with the full
  response.
- **`@error`** — HTTP failure (`!res.ok`), network error, or
  `{ error }` body. Treat as recoverable.
- **`@form`** — fires whenever a new `FormDef` arrives (initial
  step, or schema change between steps). Useful for analytics /
  step transitions.
- **`@submit`** — fires _just before_ a form submit hits the wire.
  Fires for normal submits only — actions fire `wf.action(...)`
  internally and don't trigger this event.
- **`@loading`** — fires on every transition into / out of the
  loading state. Use for skeleton UI or button-disable.

## Slots

The default slot wraps the whole component and forwards the
composable's state for total layout control:

```vue
<AsWfForm path="/api/wf" name="hello" :types="types">
  <template #default="{ form, state, actions }">
    <pre>{{ form }}</pre>
    <button :disabled="state.loading" @click="actions.retry">Retry</button>
  </template>
</AsWfForm>
```

When the default slot is **not** overridden (the usual case), the
component renders one of these named slots based on the current
state, with sensible fallbacks:

| Slot                  | When                                       | Slot props                                |
| --------------------- | ------------------------------------------ | ----------------------------------------- |
| `wf.loading`          | First load (no formDef yet)                | —                                         |
| `wf.error`            | Top-level error, no formDef                | `{ error, retry }`                        |
| `wf.finished`         | `finished === true`                        | `{ response, payload }`                   |
| `wf.finish.message`   | finished with `message`                    | `{ message }`                             |
| `wf.finish.countdown` | finished with `end.mode === 'auto'`        | `{ secondsRemaining, totalSeconds, skip, cancel }` |
| `wf.finish.skip`      | finished with `auto` end + `skipButton`    | `{ button, trigger }`                     |
| `wf.finish.primary`   | finished with `end.mode === 'manual'`      | `{ button, trigger }`                     |
| `wf.finish.option`    | finished with `manual` end (each option)   | `{ button, index, trigger }`              |
| `form.error`          | Mid-flow error (formDef exists)            | `{ error, retry }`                        |
| `form.header`         | Above the rendered form                    | Forwarded from `AsForm` + `{ loading }`   |
| `form.before`         | Inside the form, above fields              | "                                         |
| `form.after`          | Inside the form, below fields              | "                                         |
| `form.submit`         | Replace the submit button                  | `{ text, disabled, loading }`             |
| `form.footer`         | Below the form                             | "                                         |

The `wf.finished` slot's `payload` is the typed `WfFinished` envelope
(`response` is the same value, kept for back-compat). When the
envelope's `end` is set, the default rendering switches into a
`AsWfFinish` screen — see [Finish Screens](/workflows/finish-screens)
for the envelope shape, the `wf.finish.*` scoped slots, and the
`@navigate` / `@dismiss` / `@action` event contract.

Example: custom loading + finished states:

```vue
<AsWfForm path="/api/wf" name="auth/login" :types="types" @finished="onFinished">
  <template #wf.loading>
    <div class="spinner">Signing you in…</div>
  </template>

  <template #wf.finished="{ response }">
    <div class="success">
      Welcome, {{ (response as any).user.username }}!
    </div>
  </template>

  <template #wf.error="{ error, retry }">
    <div class="error">
      <p>{{ (error as any).message }}</p>
      <button @click="retry">Try again</button>
    </div>
  </template>
</AsWfForm>
```

## `useWfForm()` composable

Same plumbing without the rendering layer. Use it when:

- You want to render multiple workflows under one shell (login + MFA
  with shared chrome).
- You need to drive the flow programmatically (kick off via a button
  click, not on mount).
- You're embedding the flow in a non-standard layout (modal, wizard
  stepper, multi-pane).

```ts
import { useWfForm } from "@atscript/vue-wf";

const wf = useWfForm({
  path: "/api/wf",
  name: "auth/login",
  autoStart: false,
  tokenTransport: "cookie",
});

// Programmatic kick-off.
async function login() {
  await wf.start({
    /* optional initial input */
  });
}
```

### Return shape

```ts
interface UseWfFormReturn {
  // Reactive state
  formDef: ShallowRef<FormDef | null>;
  formData: ShallowRef<Record<string, unknown> | null>;
  formContext: ShallowRef<Record<string, unknown>>;
  errors: ShallowRef<Record<string, string>>;
  formKey: Ref<number>; // bump :key on AsForm to force remount
  loading: Ref<boolean>;
  finished: Ref<boolean>;
  response: ShallowRef<unknown>;
  error: ShallowRef<unknown>;

  // Methods
  start: (input?: Record<string, unknown>) => Promise<void>;
  submit: (data: unknown) => Promise<void>;
  action: (name: string) => Promise<void>;
  actionWithData: (name: string, data: unknown) => Promise<void>;
  retry: () => Promise<void>;
}
```

A rolled-your-own shell:

```vue
<script setup lang="ts">
import { useWfForm } from "@atscript/vue-wf";
import { AsForm, createDefaultTypes } from "@atscript/vue-form";

const wf = useWfForm({ path: "/api/wf", name: "auth/login" });
const types = createDefaultTypes();
</script>

<template>
  <div v-if="wf.loading.value && !wf.formDef.value">Loading…</div>
  <div v-else-if="wf.finished.value">Welcome!</div>
  <AsForm
    v-else-if="wf.formDef.value && wf.formData.value"
    :key="wf.formKey.value"
    :def="wf.formDef.value"
    :form-data="wf.formData.value"
    :types="types"
    :errors="wf.errors.value"
    :form-context="wf.formContext.value"
    @submit="wf.submit"
    @action="wf.action"
  />
</template>
```

Notice `:key="wf.formKey.value"` — when the schema changes between
steps, `formKey` increments; binding it as `:key` forces `AsForm` to
remount so the field components don't try to reconcile against a
new schema. The default `<AsWfForm>` does this for you.

## Custom fetch: auth headers, interceptors, status buses

The `fetch` prop swaps the function used for every request. The most
common reason: forward an Authorization header _and_ react to 401s
in a global app banner:

```ts
import { inject } from "vue";

const onAuthExpired = inject<() => void>("onAuthExpired");

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) onAuthExpired?.();
  return res;
}
```

```vue
<AsWfForm path="/api/wf" name="auth/login" :types="types" :fetch="authedFetch" />
```

A wrapper-friendly status bus typically wraps the global `fetch`
once at app boot. The same wrapper passed here keeps the workflow
client in sync with the rest of the app's HTTP behavior.

## Aborting

Every `start` / `submit` / `action` aborts the previous in-flight
request:

```ts
abortController?.abort();
abortController = new AbortController();
```

So calling `wf.action('resend')` while a slow `wf.submit(...)` is
mid-flight cancels the submit and dispatches the action. The user
never sees a "delayed" response from the old request.

The component also aborts on unmount.

## Reference

- Component: `packages/vue-wf/src/components/as-wf-form.vue`
- Composable: `packages/vue-wf/src/use-wf-form.ts`

## Where to go next

- [Form Input & Validation](/workflows/form-input) — how server-side
  errors flow back into `wf.errors`.
- [Outlets & Resume](/workflows/outlets-resume) — magic-link
  patterns using `initialToken`.
- [Recipes](/workflows/recipes) — end-to-end flows.
