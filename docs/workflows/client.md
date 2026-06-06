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
  // response = { finished: true, ...envelope } — the marker is supplied by
  // handleAsOutletRequest; the envelope's `data` is what the step passed
  // via finishWf({ data }) server-side.
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
  /** Forwarded to `<AsForm>`. Suppress the root field's title only (the description still renders). */
  hideRootTitle?: boolean;
  /** Forwarded to `<AsForm>`. Suppress the default submit button. */
  hideSubmit?: boolean;

  // ── Finish screen routing ──────────────────────────────────
  /**
   * Forwarded to `<AsWfFinish>`. Invoked with the redirect target URL
   * when a `redirect` action fires. Matches the `navigate` option on
   * `@atscript/db-client`'s `Client` so one handler covers both.
   */
  navigate?: (url: string) => void | Promise<void>;
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
  // `next` triggers an action. See "Finish Screens".
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

| Slot                  | When                                                                            | Slot props                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `wf.loading`          | First load (no formDef yet)                                                     | — (default: `as-form-overlay` spinner on a `min-h-[100px]` wrapper, matching the overlay shown on subsequent round-trips) |
| `wf.error`            | Transport error — both before a form loads AND as a banner above a mounted form | `{ error, retry }`                                                                                                        |
| `wf.finished`         | `finished === true`                                                             | `{ response, payload }`                                                                                                   |
| `wf.finish.message`   | finished with `message`                                                         | `{ message }`                                                                                                             |
| `wf.finish.countdown` | finished with `next.trigger === 'auto'`                                         | `{ secondsRemaining, totalSeconds, skip, cancel }`                                                                        |
| `wf.finish.skip`      | finished with `auto` next + `skipButton`                                        | `{ button, trigger }`                                                                                                     |
| `wf.finish.primary`   | finished with `next.trigger === 'manual'`                                       | `{ button, trigger }`                                                                                                     |
| `wf.finish.option`    | finished with `manual` next (each option)                                       | `{ button, index, trigger }`                                                                                              |
| `form.header`         | Above the rendered form                                                         | The forwarded `AsForm` `slotProps` bag                                                                                    |
| `form.before`         | Inside the form, above fields                                                   | "                                                                                                                         |
| `form.after`          | Inside the form, below fields                                                   | "                                                                                                                         |
| `form.error`          | `AsForm` form-level error banner                                                | bag + `message`, `dismiss`                                                                                                |
| `form.submit`         | Replace the submit button                                                       | bag + `text`                                                                                                              |
| `form.footer`         | Below the form                                                                  | "                                                                                                                         |
| `form.loading`        | Contents of the loading overlay                                                 | "                                                                                                                         |

The `form.*` slots are forwarded straight through to the inner
`<AsForm>`, so each receives the **same `slotProps` bag** an AsForm slot
gets (`title`, `description`, `data`, `errors`, `formError`, `loading`,
`submit`, `reset`, …). See
[Forms — Slots & the slotProps bag](/forms/customization#slots-the-slotprops-bag)
for the full bag — it isn't restated here. `hideRootTitle` and
`hideSubmit` are likewise forwarded to `<AsForm>` (`hideRootTitle` hides the
root title only — the `@meta.description` still renders; see
[Forms — Hide props](/forms/customization#hide-props)), and **styling a wf form
is identical to styling any form** — override the relevant `as-*`
shortcut (see [Overriding a built-in `as-*` shortcut](/styling/shortcuts#overriding-a-built-in-as-shortcut)).

The `wf.finished` slot's `payload` is the typed `WfFinished` envelope
(`response` is the same value, kept for back-compat). When the
envelope's `next` is set, the default rendering switches into a
`AsWfFinish` screen — see [Finish Screens](/workflows/finish-screens)
for the envelope shape, the `wf.finish.*` scoped slots, the
`navigate` prop wiring, and the `@dismiss` / `@action` event contract.

Example: custom loading + finished states. The `wf.loading` slot
already has a default — the same `as-form-overlay` spinner that paints
on subsequent round-trips, on a wrapper with `min-h-[100px]` so the
page doesn't jump. Override only to swap in a branded indicator or
copy:

```vue
<AsWfForm path="/api/wf" name="auth/login" :types="types" @finished="onFinished">
  <template #wf.loading>
    <div class="spinner">Signing you in…</div>
  </template>

  <template #wf.finished="{ response, payload }">
    <!-- `payload` is the typed `WfFinished` envelope; `response` is the same
         value kept for back-compat. `payload` is `null` when the flow ended
         via an outlet pause (`{ sent: true }` / `{ outlet: '<name>' }`)
         rather than a true `finished: true` envelope. -->
    <div v-if="payload?.message" class="banner">
      {{ payload.message.text }}
    </div>
    <div class="success">
      Welcome, {{ (payload?.data as any)?.user?.username }}!
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

Providing `#wf.finished` opts out of the default `AsWfFinish` rendering —
the consumer takes full responsibility for the finish UI (including any
`next.action` wiring). To keep `AsWfFinish` and only restyle one piece,
override a `#wf.finish.*` sub-slot instead. See
[Finish Screens](/workflows/finish-screens) for the sub-slot contract.

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

A rolled-your-own shell. Note that the placeholder text below is just
illustrative — `<AsWfForm>` renders an `as-form-overlay` spinner on a
`min-h-[100px]` wrapper during the first round-trip by default, so when
you stick with the wrapper component you get the overlay for free:

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

## SSR

`<AsWfForm>` calls `start(input)` from `onMounted` by default, which `fetch`es `path` to retrieve the first form schema. Under SSR (`createSSRApp`) `onMounted` runs at hydration time on the client — but if a parent mounts a child `<AsWfForm>` during server rendering (e.g. inside a `<Suspense>` boundary that awaits child effects), the `fetch` fires in Node and either crashes (no `globalThis.fetch` polyfill) or hits your own server from itself.

Two equivalent guards:

```vue
<!-- 1. Set autoStart="false" and trigger explicitly after hydration. -->
<AsWfForm v-slot="{ actions }" path="/wf" name="…" :types :auto-start="false">
  <button @click="actions.start()">Begin</button>
</AsWfForm>

<!-- 2. v-if on a client-only ref. -->
<AsWfForm v-if="hydrated" path="/wf" name="…" :types />
```

```ts
import { onMounted, ref } from "vue";
export function useHydrated() {
  const hydrated = ref(false);
  onMounted(() => (hydrated.value = true));
  return hydrated;
}
```

The `<AsForm>` shell itself is SSR-safe — it has nothing to render until `formDef` is populated, so the only concern is the auto-`fetch` on mount. `useWfForm()` direct callers get the same `autoStart: false` knob.

## Reference

- Component: `packages/vue-wf/src/components/as-wf-form.vue`
- Composable: `packages/vue-wf/src/use-wf-form.ts`

## Where to go next

- [Form Input & Validation](/workflows/form-input) — how server-side
  errors flow back into `wf.errors`.
- [Outlets & Resume](/workflows/outlets-resume) — magic-link
  patterns using `initialToken`.
- [Recipes](/workflows/recipes) — end-to-end flows.
