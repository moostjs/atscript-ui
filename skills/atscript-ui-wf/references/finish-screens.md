# finish-screens

Terminal-screen rendering for workflows: the `WfFinished` envelope, the two
author-facing helpers (`finishWf` / `abortWf`), the default `AsWfFinish`
component shipped via `<AsWfForm>`, scoped-slot overrides, action events,
and the opt-in SSR adapter.

## Contents

- [Envelope shape](#envelope-shape)
- [Helpers — finishWf and abortWf](#helpers--finishwf-and-abortwf)
- [Next triggers — rendering rules](#next-triggers--rendering-rules)
- [Slot contract](#slot-contract)
- [Routing & events — `navigate` prop, `@dismiss`, `@action`](#routing--events--navigate-prop-dismiss-action)

## Envelope shape

Source: `packages/moost-wf/src/wf-finished.ts`.

```ts
interface WfFinished<TData = unknown> {
  finished: true;
  data?: TData;
  message?: WfMessage;
  next?: WfNext;
  aborted?: boolean;
  reason?: string;
}

interface WfMessage {
  level: "info" | "success" | "warn" | "error";
  text: string;
}

type WfNext =
  | { trigger: "immediate"; action: WfAction }
  | {
      trigger: "auto";
      timeoutMs: number;
      action: WfAction;
      skipButton?: { label: string; behavior?: "now" | "cancel" };
    }
  | { trigger: "manual"; primary?: WfButton; options?: WfButton[] };

interface WfButton {
  label: string;
  action: WfAction;
}

type WfAction =
  | { type: "redirect"; target: string; reason?: string }
  | { type: "reload" }
  | { type: "dismiss" };
```

Step handlers must produce envelopes via the helpers below, not by setting
`finished: true` inside `useWfFinished().set({ value })`. The HTTP adapter
auto-injects the marker for bare returns; the helpers already include it.

## Helpers — finishWf and abortWf

```ts
interface FinishWfOpts<T = unknown> {
  data?: T;
  message?: WfMessage;
  next?: WfNext;
}

function finishWf<T = unknown>(opts?: FinishWfOpts<T>): void;
function abortWf(reason: string, opts?: FinishWfOpts): void;
```

One row per terminal outcome. Pick the call literal that matches the
envelope you want on the wire:

| Outcome                | Call                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain payload         | `finishWf({ data: { id: 42 } })`                                                                                                                                                |
| Message-only           | `finishWf({ message: { level: "success", text: "Saved." } })`                                                                                                                   |
| Immediate redirect     | `finishWf({ next: { trigger: "immediate", action: { type: "redirect", target: "/home" } } })`                                                                                   |
| Auto redirect + skip   | `finishWf({ next: { trigger: "auto", timeoutMs: 4000, action: { type: "redirect", target: "/home" }, skipButton: { label: "Go now" } } })`                                      |
| Manual choice          | `finishWf({ next: { trigger: "manual", primary: { label: "Go", action: { type: "redirect", target: "/x" } }, options: [{ label: "Dismiss", action: { type: "dismiss" } }] } })` |
| Aborted (soft-failure) | `abortWf("rate-limited", { message: { level: "warn", text: "Try later." } })`                                                                                                   |

Cookies stay on the raw wooks call — `useWfFinished().set({ type: "data",
value: envelope, cookies: { ... } })` — because cookies are an HTTP-level
concern orthogonal to the envelope. Construct the envelope by hand and pass
it as `value`.

```ts
import { finishWf, abortWf } from "@atscript/moost-wf";

// Auto-redirect with countdown.
finishWf({
  message: { level: "success", text: "All set!" },
  next: {
    trigger: "auto",
    timeoutMs: 4000,
    action: { type: "redirect", target: "/dashboard" },
    skipButton: { label: "Go now" },
  },
});

// Manual choice.
finishWf({
  message: { level: "info", text: "What's next?" },
  next: {
    trigger: "manual",
    primary: { label: "View order", action: { type: "redirect", target: "/orders/42" } },
    options: [
      { label: "Submit another", action: { type: "redirect", target: "/submit" } },
      { label: "Done", action: { type: "dismiss" } },
    ],
  },
});

// Aborted with a banner.
abortWf("rate-limited", {
  message: { level: "warn", text: "Too many attempts. Try again in 5 minutes." },
});
```

## Next triggers — rendering rules

The default `AsWfFinish` (Tier-2, swappable) reads `payload.next.trigger`:

- **`immediate`** — no DOM rendered; action fires on mount. `redirect`
  invokes the `navigate` prop (if provided), otherwise falls back to
  `window.location.assign`. In a non-browser context with no prop, logs
  `console.error` and stays put.
- **`auto`** — filled primary CTA (the skip button) whose background
  fills L→R with a `bg-black/20` darken overlay over `timeoutMs`, plus
  a smaller muted countdown line ("Continuing in N…") centered below.
  The button **is** the progress indicator — no separate progress
  bar. Built on the public `c8-progress` shortcut family in
  `@atscript/ui-styles` (`c8-filled scope-primary c8-progress` +
  `c8-progress-fill` + `c8-progress-label`); reusable for any
  "fills then fires" UI. Animation is CSS-driven via
  `@keyframes progress-fill` + `--progress-duration`; the JS
  countdown ticks at 250ms internally, integer-only transitions.
  Timer fires after `timeoutMs`; skip-button behaviour `"now"`
  (default) fires immediately, `"cancel"` only clears the timer and
  leaves the user on the screen. If `skipButton` is omitted from the
  envelope, only the countdown line renders.
- **`manual`** — message banner + buttons. Primary (if set) gets initial
  focus and is the Enter-key target; otherwise the first option does.

When `next` is omitted, `AsWfFinish` renders the `message` (if any) and
waits — the consumer's `@finished` handler drives the next action.

## Slot contract

Source: `packages/vue-wf/src/components/as-wf-form.vue` slot-forwarding
block, `packages/vue-wf/src/components/defaults/as-wf-finish.vue` slot
declarations.

| Slot (forwarded by `<AsWfForm>`) | Scope                                                                      | Renders when                                 |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| `wf.finished`                    | `{ response, payload }`                                                    | full override of the finish screen           |
| `wf.finish.message`              | `{ message: WfMessage }`                                                   | `payload.message` is set                     |
| `wf.finish.countdown`            | `{ secondsRemaining, totalSeconds, skip: () => void, cancel: () => void }` | `next.trigger === 'auto'`                    |
| `wf.finish.skip`                 | `{ button: { label, behavior }, trigger: () => void }`                     | `next.trigger === 'auto'` + `skipButton` set |
| `wf.finish.primary`              | `{ button: WfButton, trigger: () => void }`                                | `next.trigger === 'manual'` + primary set    |
| `wf.finish.option`               | `{ button: WfButton, index: number, trigger: () => void }`                 | `next.trigger === 'manual'` (per option)     |

Overrides must call the `trigger` callback to run the action — it preserves
the redirect / reload / dismiss decision logic. Reimplementing the action
inside the override loses the dev-only fallback warning and the `@action`
analytics emit.

```vue
<AsWfForm path="/api/wf" name="checkout" :types="types" :navigate="navigate">
  <template #wf.finish.primary="{ button, trigger }">
    <MyBrandButton variant="filled" @click="trigger">{{ button.label }}</MyBrandButton>
  </template>
</AsWfForm>
```

> [feedback_vue_empty_slot](file:///Users/mavrik/.claude/projects/-Users-mavrik-code-atscript-ui/memory/feedback_vue_empty_slot.md): `<AsWfForm>` only forwards a `wf.finish.*` slot to `AsWfFinish` when the consumer actually provides one (`$slots['wf.finish.message']` guard). An empty `<template #wf.finish.message />` would otherwise suppress the default fallback — but since the consumer never provided the slot in that case, the guard preserves the default.

## Routing & events — `navigate` prop, `@dismiss`, `@action`

```ts
interface AsWfFormProps {
  // …
  navigate?: (url: string) => void | Promise<void>;
}

defineEmits<{
  (e: "dismiss"): void;
  (e: "action", action: WfAction): void;
}>();
```

- `navigate` prop — receives the redirect target URL. Wire to your router:
  ```ts
  const navigate = (url: string) => router.push(url);
  ```
  Matches the `navigate` option on `@atscript/db-client`'s `Client` so one
  handler covers both workflow redirects and DB `processor: 'navigate'`
  actions. When omitted, `AsWfFinish` falls back to
  `window.location.assign(url)`; in a non-browser context with no prop, it
  logs `console.error` and stays put.
- `@dismiss` — fires on `action.type === 'dismiss'`. Use to close modals or
  reset state — `AsWfFinish` does not navigate.
- `@action` — fires on every action (redirect / reload / dismiss). Analytics
  hook; the `reason` field on `redirect` actions flows through this event.
