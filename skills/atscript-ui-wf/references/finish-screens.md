# finish-screens

Terminal-screen rendering for workflows: the `WfFinished` envelope, the five
author-facing helpers, the default `AsWfFinish` component shipped via
`<AsWfForm>`, scoped-slot overrides, action events, and the opt-in SSR adapter.

## Contents

- [Envelope shape](#envelope-shape)
- [Helpers — which one to pick](#helpers--which-one-to-pick)
- [End modes — rendering rules](#end-modes--rendering-rules)
- [Slot contract](#slot-contract)
- [Events — `@navigate` / `@dismiss` / `@action`](#events--navigate--dismiss--action)
- [SSR adapter (opt-in)](#ssr-adapter-opt-in)

## Envelope shape

Source: `packages/moost-wf/src/wf-finished.ts`.

```ts
interface WfFinished<TData = unknown> {
  finished: true;
  data?: TData;
  message?: WfMessage;
  end?: WfFinishedEnd;
  aborted?: boolean;
  reason?: string;
}

interface WfMessage { level: "info" | "success" | "warn" | "error"; text: string; }

type WfFinishedEnd =
  | { mode: "immediate"; action: WfAction }
  | { mode: "auto"; timeoutMs: number; action: WfAction; skipButton?: { label: string; behavior?: "now" | "cancel" } }
  | { mode: "manual"; primary?: WfButton; options?: WfButton[] };

interface WfButton { label: string; action: WfAction; }

type WfAction =
  | { type: "redirect"; target: string; mode: "soft" | "hard"; reason?: string }
  | { type: "reload" }
  | { type: "dismiss" };
```

Step handlers must produce envelopes via the helpers below, not by setting
`finished: true` inside `useWfFinished().set({ value })`. The HTTP adapter
auto-injects the marker for bare returns; helpers already include it.

## Helpers — which one to pick

| Helper                              | Use when                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| `finishWfWithData(data, message?)`  | Domain payload, consumer drives next UX itself                      |
| `finishWfWithMessage(level, text)`  | Pure status message, no transition                                  |
| `finishWfWithRedirect(target, opts)`| Redirect; pass `autoMs` for countdown + `skipLabel` for skip button |
| `finishWfWithChoice({ primary?, options? })` | Manual mode — user picks; requires at least one button     |
| `finishWfAborted(reason, opts?)`    | Terminal soft-failure (`aborted: true`)                             |
| `finishWf(envelope)`                | Escape hatch — combination the helpers don't cover                  |

Cookies stay on the raw wooks call — `useWfFinished().set({ type: "data",
value: envelope, cookies: { ... } })` — because cookies are an HTTP-level
concern orthogonal to the envelope. Construct the envelope by hand and pass
it as `value`.

```ts
import { finishWfWithRedirect, finishWfWithChoice } from "@atscript/moost-wf";

// Auto-redirect with countdown.
finishWfWithRedirect("/dashboard", {
  mode: "soft",
  autoMs: 4000,
  skipLabel: "Go now",
  message: { level: "success", text: "All set!" },
});

// Manual choice.
finishWfWithChoice({
  message: { level: "info", text: "What's next?" },
  primary: { label: "View order", action: { type: "redirect", target: "/orders/42", mode: "soft" } },
  options: [
    { label: "Submit another", action: { type: "redirect", target: "/submit", mode: "soft" } },
    { label: "Done", action: { type: "dismiss" } },
  ],
});
```

## End modes — rendering rules

The default `AsWfFinish` (Tier-2, swappable) reads `payload.end.mode`:

- **`immediate`** — no DOM rendered; action fires on mount. `redirect/soft`
  emits `@navigate`; `redirect/hard` calls `window.location.href`. If no
  `@navigate` listener is attached for a soft redirect, fallback to
  `window.location.href` + a dev-only `console.warn`.
- **`auto`** — countdown text + optional skip button. Timer fires after
  `timeoutMs`; skip-button behaviour `"now"` (default) fires immediately,
  `"cancel"` only clears the timer and leaves the user on the screen.
- **`manual`** — message banner + buttons. Primary (if set) gets initial
  focus and is the Enter-key target; otherwise the first option does.

When `end` is omitted, `AsWfFinish` renders the `message` (if any) and
waits — the consumer's `@finished` handler drives the next action.

## Slot contract

Source: `packages/vue-wf/src/components/as-wf-form.vue` slot-forwarding
block, `packages/vue-wf/src/components/defaults/as-wf-finish.vue` slot
declarations.

| Slot (forwarded by `<AsWfForm>`) | Scope                                                                                | Renders when                                  |
| -------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| `wf.finished`                    | `{ response, payload }`                                                              | full override of the finish screen            |
| `wf.finish.message`              | `{ message: WfMessage }`                                                             | `payload.message` is set                      |
| `wf.finish.countdown`            | `{ secondsRemaining, totalSeconds, skip: () => void, cancel: () => void }`           | `end.mode === 'auto'`                         |
| `wf.finish.skip`                 | `{ button: { label, behavior }, trigger: () => void }`                               | `end.mode === 'auto'` + `skipButton` set      |
| `wf.finish.primary`              | `{ button: WfButton, trigger: () => void }`                                          | `end.mode === 'manual'` + primary set         |
| `wf.finish.option`               | `{ button: WfButton, index: number, trigger: () => void }`                           | `end.mode === 'manual'` (per option)          |

Overrides must call the `trigger` callback to run the action — it preserves
the redirect / reload / dismiss decision logic. Reimplementing the action
inside the override loses the dev-only fallback warning and the `@action`
analytics emit.

```vue
<AsWfForm path="/api/wf" name="checkout" :types="types" @navigate="router.push">
  <template #wf.finish.primary="{ button, trigger }">
    <MyBrandButton variant="filled" @click="trigger">{{ button.label }}</MyBrandButton>
  </template>
</AsWfForm>
```

> [feedback_vue_empty_slot](file:///Users/mavrik/.claude/projects/-Users-mavrik-code-atscript-ui/memory/feedback_vue_empty_slot.md): `<AsWfForm>` only forwards a `wf.finish.*` slot to `AsWfFinish` when the consumer actually provides one (`$slots['wf.finish.message']` guard). An empty `<template #wf.finish.message />` would otherwise suppress the default fallback — but since the consumer never provided the slot in that case, the guard preserves the default.

## Events — `@navigate` / `@dismiss` / `@action`

```ts
defineEmits<{
  (e: "navigate", payload: { target: string; mode: "soft" | "hard"; reason?: string }): void;
  (e: "dismiss"): void;
  (e: "action", action: WfAction): void;
}>();
```

- `@navigate` — fires on `redirect/soft`. Wire to `router.push`:
  ```ts
  function onNavigate(p: { target: string }) { void router.push(p.target); }
  ```
- `@dismiss` — fires on `action.type === 'dismiss'`. Use to close modals or
  reset state — `AsWfFinish` does not navigate.
- `@action` — fires on every action (redirect / reload / dismiss). Analytics
  hook; does not control navigation.

Hard redirects (`mode: "hard"`) bypass `@navigate` and call
`window.location.href`. There is no way to intercept them other than
overriding the `wf.finish.primary` / `wf.finish.option` / `wf.finish.skip`
slots with custom triggers.

## SSR adapter (opt-in)

Source: `packages/moost-wf/src/ssr-adapter.ts` exported from
`@atscript/moost-wf/ssr-adapter`.

Install on the controller / handler serving the workflow route when you need
SSR or no-JS consumers to follow `mode: 'immediate'` redirects:

```ts
import { Controller, Intercept } from "moost";
import { workflowSsrAdapter } from "@atscript/moost-wf/ssr-adapter";

@Controller("/auth")
@Intercept(workflowSsrAdapter)
export class AuthController { /* ... */ }
```

- `mode: 'hard'` → 303 + `Location:` header, empty body.
- `mode: 'soft'` → 302 + `Location:` header, empty body.
- `mode: 'auto'` / `mode: 'manual'` / no `end` → pass-through as 200 JSON
  (need client-side rendering).

The interceptor reads the response body, checks `isWfFinished()`, and
rewrites only the `immediate` redirect branch. Everything else flows
through untouched.
